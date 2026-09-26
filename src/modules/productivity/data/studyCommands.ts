import { addDaysIso, toIsoDate, type IsoDate } from '@/shared/dates';
import { nowIso, write, type Db, type EntityWriter } from '@/shared/db';
import { enumOr, parseInput } from '@/shared/validation';

import {
  studyKinds,
  studySessionInputSchema,
  type StudySession,
  type StudySessionInput,
} from '../domain/studySession';
import { markStudyHabits } from './habitCommands';
import { markRevisionDoneForSession } from './revisionCommands';

export type StudySessionRow = {
  id: string;
  subject_id: string | null;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  kind: string;
};

const ALIVE = 'deleted_at IS NULL';

export const toStudySession = (r: StudySessionRow): StudySession => ({
  id: r.id,
  subjectId: r.subject_id,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  plannedMinutes: r.planned_minutes,
  kind: enumOr(studyKinds, r.kind, 'focus'),
});

/** Démarre une session ; une seule session en cours à la fois (les autres sont clôturées). */
export async function startStudySession(db: Db, input: StudySessionInput): Promise<string> {
  const v = parseInput(studySessionInputSchema, input);
  return write(db, async (w) => {
    const open = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM study_sessions WHERE ${ALIVE} AND ended_at IS NULL`,
      [],
    );
    for (const o of open) await w.update('study_sessions', o.id, { ended_at: nowIso() });
    return w.insert('study_sessions', {
      subject_id: v.subjectId,
      started_at: v.startedAt,
      planned_minutes: v.plannedMinutes,
      kind: v.kind,
      ended_at: null,
    });
  });
}

/** Termine la session (arrêt manuel ou fin du minuteur). `endedAt` ≤ fin prévue. */
/** Minutes de travail minimum pour qu'une session coche l'habitude « Réviser ». */
export const STUDY_HABIT_MIN_MINUTES = 5;

export async function endStudySession(db: Db, id: string, endedAt = nowIso()): Promise<void> {
  await write(db, async (w) => {
    const row = await w.db.getFirstAsync<StudySessionRow>(
      'SELECT * FROM study_sessions WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    // Idempotente : une session déjà terminée garde sa fin (double appel minuteur + bouton).
    if (!row || row.ended_at !== null) return;
    await w.update('study_sessions', id, { ended_at: endedAt });
    if (row.kind !== 'focus') return;
    const minutes = (new Date(endedAt).getTime() - new Date(row.started_at).getTime()) / 60_000;
    if (minutes >= STUDY_HABIT_MIN_MINUTES) {
      await markStudyHabits(w, endedAt);
      await markRevisionDoneForSession(w, id);
    }
  });
}

export async function deleteStudySession(db: Db, id: string): Promise<void> {
  await write(db, (w) => w.softDelete('study_sessions', id));
}

/** La session en cours (non terminée), s'il y en a une. */
export async function getActiveStudySession(db: Db): Promise<StudySession | null> {
  const row = await db.getFirstAsync<StudySessionRow>(
    `SELECT * FROM study_sessions WHERE ${ALIVE} AND ended_at IS NULL ORDER BY started_at DESC`,
    [],
  );
  return row ? toStudySession(row) : null;
}

/**
 * Sessions commencées entre deux dates (jours LOCAUX inclus). `started_at` est en UTC : la requête
 * prend un jour de marge de chaque côté (une session à 00:30 à Douala est la veille en UTC), puis
 * le tri se fait sur le jour local, comme `studyTotals`.
 */
export async function listStudySessions(
  db: Db,
  from: IsoDate,
  to: IsoDate,
): Promise<StudySession[]> {
  const rows = await db.getAllAsync<StudySessionRow>(
    `SELECT * FROM study_sessions WHERE ${ALIVE} AND started_at >= ? AND started_at < ?
     ORDER BY started_at DESC`,
    [`${addDaysIso(from, -1)}T00:00:00`, `${addDaysIso(to, 2)}T00:00:00`],
  );
  return rows.map(toStudySession).filter((s) => {
    const day = toIsoDate(new Date(s.startedAt));
    return day >= from && day <= to;
  });
}

/** Une matière supprimée : ses sessions de révision restent, sans matière. */
export async function detachStudySessionsFromSubject(w: EntityWriter, subjectId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    `SELECT id FROM study_sessions WHERE ${ALIVE} AND subject_id = ?`,
    [subjectId],
  );
  for (const r of rows) await w.update('study_sessions', r.id, { subject_id: null });
}
