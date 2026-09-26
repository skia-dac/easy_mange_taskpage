import { nowIso, write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import {
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
  kind: r.kind as StudySession['kind'],
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

/** Sessions commencées entre deux dates ISO (jours inclus). */
export async function listStudySessions(db: Db, from: string, to: string): Promise<StudySession[]> {
  const rows = await db.getAllAsync<StudySessionRow>(
    `SELECT * FROM study_sessions WHERE ${ALIVE} AND started_at >= ? AND started_at < ?
     ORDER BY started_at DESC`,
    [`${from}T00:00:00`, `${to}T23:59:59.999Z`],
  );
  return rows.map(toStudySession);
}

/** Une matière supprimée : ses sessions de révision restent, sans matière. */
export async function detachStudySessionsFromSubject(w: EntityWriter, subjectId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    `SELECT id FROM study_sessions WHERE ${ALIVE} AND subject_id = ?`,
    [subjectId],
  );
  for (const r of rows) await w.update('study_sessions', r.id, { subject_id: null });
}
