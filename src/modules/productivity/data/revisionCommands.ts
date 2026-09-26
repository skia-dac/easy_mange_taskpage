import type { IsoDate } from '@/shared/dates';
import { write, type Db, type EntityWriter } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { enumOr, parseInput } from '@/shared/validation';

import {
  revisionBlockInputSchema,
  revisionStatuses,
  type RevisionBlock,
  type RevisionBlockInput,
  type RevisionStatus,
} from '../domain/revision';

type RevisionBlockRow = {
  id: string;
  subject_id: string | null;
  exam_id: string | null;
  timetable_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  title: string | null;
  status: string;
  study_session_id: string | null;
};

const ALIVE = 'deleted_at IS NULL';

const toRevisionBlock = (r: RevisionBlockRow): RevisionBlock => ({
  id: r.id,
  subjectId: r.subject_id,
  examId: r.exam_id,
  timetableId: r.timetable_id,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  title: r.title,
  status: enumOr(revisionStatuses, r.status, 'planned'),
  studySessionId: r.study_session_id,
});

function blockValues(input: RevisionBlockInput) {
  const v = parseInput(revisionBlockInputSchema, input);
  return {
    subject_id: v.subjectId,
    exam_id: v.examId,
    timetable_id: v.timetableId,
    date: v.date,
    start_time: v.startTime,
    end_time: v.endTime,
    title: v.title,
  };
}

export async function listRevisionBlocks(
  db: Db,
  range: { from?: IsoDate; to?: IsoDate; examId?: string } = {},
): Promise<RevisionBlock[]> {
  const where = [ALIVE];
  const params: string[] = [];
  if (range.from) {
    where.push('date >= ?');
    params.push(range.from);
  }
  if (range.to) {
    where.push('date <= ?');
    params.push(range.to);
  }
  if (range.examId) {
    where.push('exam_id = ?');
    params.push(range.examId);
  }
  const rows = await db.getAllAsync<RevisionBlockRow>(
    `SELECT * FROM revision_blocks WHERE ${where.join(' AND ')} ORDER BY date, start_time`,
    params,
  );
  return rows.map(toRevisionBlock);
}

export async function getRevisionBlock(db: Db, id: string): Promise<RevisionBlock | null> {
  const row = await db.getFirstAsync<RevisionBlockRow>(
    `SELECT * FROM revision_blocks WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toRevisionBlock(row) : null;
}

export async function createRevisionBlock(db: Db, input: RevisionBlockInput) {
  const values = blockValues(input);
  return write(db, (w) => w.insert('revision_blocks', { ...values, status: 'planned' }));
}

/** Enregistre en une fois les séances validées d'un plan de révision. */
export async function createRevisionBlocks(
  db: Db,
  inputs: readonly RevisionBlockInput[],
): Promise<string[]> {
  return write(db, (w) => insertRevisionBlocks(w, inputs));
}

export async function insertRevisionBlocks(
  w: EntityWriter,
  inputs: readonly RevisionBlockInput[],
): Promise<string[]> {
  const values = inputs.map(blockValues);
  const ids: string[] = [];
  for (const v of values) ids.push(await w.insert('revision_blocks', { ...v, status: 'planned' }));
  return ids;
}

export async function updateRevisionBlock(db: Db, id: string, input: RevisionBlockInput) {
  const values = blockValues(input);
  return write(db, (w) => w.update('revision_blocks', id, values));
}

/** Déplacement par glisser-déposer : même durée, autre jour / heure. */
export async function moveRevisionBlock(
  db: Db,
  id: string,
  to: { date: IsoDate; startTime: string; endTime: string },
) {
  return write(db, async (w) => {
    const current = await w.db.getFirstAsync<RevisionBlockRow>(
      `SELECT * FROM revision_blocks WHERE id = ? AND ${ALIVE}`,
      [id],
    );
    if (!current) throw new AppError('notFound');
    const values = blockValues({ ...toRevisionBlock(current), ...to });
    await w.update('revision_blocks', id, values);
  });
}

export async function setRevisionStatus(db: Db, id: string, status: RevisionStatus) {
  return write(db, (w) => w.update('revision_blocks', id, { status }));
}

export async function deleteRevisionBlock(db: Db, id: string) {
  return write(db, (w) => w.softDelete('revision_blocks', id));
}

/** Supprime les séances encore prévues d'un examen (pour refaire le plan). */
export async function deletePlannedRevisionsOfExam(db: Db, examId: string) {
  return write(db, async (w) => {
    const rows = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM revision_blocks WHERE ${ALIVE} AND exam_id = ? AND status = 'planned'`,
      [examId],
    );
    for (const r of rows) await w.softDelete('revision_blocks', r.id);
  });
}

/** Une session Pomodoro lancée depuis une séance de révision lui est rattachée. */
export async function linkStudySession(db: Db, blockId: string, sessionId: string) {
  return write(db, (w) => w.update('revision_blocks', blockId, { study_session_id: sessionId }));
}

/** Fin d'une session assez longue : la séance de révision rattachée est faite. */
export async function markRevisionDoneForSession(w: EntityWriter, sessionId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    `SELECT id FROM revision_blocks WHERE ${ALIVE} AND study_session_id = ? AND status <> 'done'`,
    [sessionId],
  );
  for (const r of rows) await w.update('revision_blocks', r.id, { status: 'done' });
}
