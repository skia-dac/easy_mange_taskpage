import type { Db } from '@/shared/db';

import type { WorkKind } from '../domain/workItem';
import {
  tableOf,
  toPersonalEvent,
  toWorkItem,
  type PersonalEventRow,
  type WorkItemRow,
} from './rows';

const ALIVE = 'deleted_at IS NULL';

export async function listWorkItems(db: Db, kind: WorkKind, filter: { subjectId?: string } = {}) {
  const table = tableOf(kind);
  const rows = filter.subjectId
    ? await db.getAllAsync<WorkItemRow>(
        `SELECT * FROM ${table} WHERE ${ALIVE} AND subject_id = ? ORDER BY due_date, due_time`,
        [filter.subjectId],
      )
    : await db.getAllAsync<WorkItemRow>(
        `SELECT * FROM ${table} WHERE ${ALIVE} ORDER BY due_date, due_time`,
        [],
      );
  return rows.map(toWorkItem(kind));
}

export async function getWorkItem(db: Db, kind: WorkKind, id: string) {
  const row = await db.getFirstAsync<WorkItemRow>(
    `SELECT * FROM ${tableOf(kind)} WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toWorkItem(kind)(row) : null;
}

export async function listPersonalEvents(db: Db) {
  const rows = await db.getAllAsync<PersonalEventRow>(
    `SELECT * FROM personal_events WHERE ${ALIVE} ORDER BY date, start_time`,
    [],
  );
  return rows.map(toPersonalEvent);
}

export async function getPersonalEvent(db: Db, id: string) {
  const row = await db.getFirstAsync<PersonalEventRow>(
    `SELECT * FROM personal_events WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toPersonalEvent(row) : null;
}

/** Nombre de tâches et devoirs liés à une matière (avant sa suppression). */
export async function countWorkForSubject(db: Db, subjectId: string) {
  const count = async (table: string) =>
    (
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${ALIVE} AND subject_id = ?`,
        [subjectId],
      )
    )?.n ?? 0;
  return { tasks: await count('tasks'), assignments: await count('assignments') };
}

export async function searchWorkItems(db: Db, kind: WorkKind, query: string) {
  const q = `%${query.trim().replace(/[%_\\]/g, '')}%`;
  const rows = await db.getAllAsync<WorkItemRow>(
    `SELECT w.* FROM ${tableOf(kind)} w LEFT JOIN subjects s ON s.id = w.subject_id
     WHERE w.deleted_at IS NULL AND (w.title LIKE ? OR w.description LIKE ? OR s.name LIKE ?)
     ORDER BY w.due_date LIMIT 20`,
    [q, q, q],
  );
  return rows.map(toWorkItem(kind));
}

export async function searchPersonalEvents(db: Db, query: string) {
  const q = `%${query.trim().replace(/[%_\\]/g, '')}%`;
  const rows = await db.getAllAsync<PersonalEventRow>(
    `SELECT * FROM personal_events WHERE ${ALIVE} AND (title LIKE ? OR description LIKE ?) ORDER BY date LIMIT 20`,
    [q, q],
  );
  return rows.map(toPersonalEvent);
}
