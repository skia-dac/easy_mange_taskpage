import { write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { subtaskTitleSchema, type Subtask, type WorkKind } from '../domain/workItem';

type SubtaskRow = {
  id: string;
  work_kind: string;
  work_id: string;
  title: string;
  done: number;
  position: number;
};

const ALIVE = 'deleted_at IS NULL';

const toSubtask = (r: SubtaskRow): Subtask => ({
  id: r.id,
  workKind: r.work_kind as WorkKind,
  workId: r.work_id,
  title: r.title,
  done: r.done === 1,
  position: r.position,
});

async function rowsOf(db: Db, kind: WorkKind, workId: string) {
  return db.getAllAsync<SubtaskRow>(
    `SELECT * FROM work_subtasks WHERE ${ALIVE} AND work_kind = ? AND work_id = ?
     ORDER BY position, created_at`,
    [kind, workId],
  );
}

/** Checklist d'une tâche ou d'un devoir, dans l'ordre. */
export async function listSubtasks(db: Db, kind: WorkKind, workId: string): Promise<Subtask[]> {
  return (await rowsOf(db, kind, workId)).map(toSubtask);
}

/** Avancement de toutes les checklists : clé `${kind}:${id}` → { done, total }. */
export async function subtaskCounts(db: Db): Promise<Map<string, { done: number; total: number }>> {
  const rows = await db.getAllAsync<{
    work_kind: string;
    work_id: string;
    done: number;
    total: number;
  }>(
    `SELECT work_kind, work_id, SUM(done) AS done, COUNT(*) AS total FROM work_subtasks
     WHERE ${ALIVE} GROUP BY work_kind, work_id`,
    [],
  );
  return new Map(
    rows.map((r) => [`${r.work_kind}:${r.work_id}`, { done: r.done, total: r.total }]),
  );
}

export async function addSubtask(db: Db, kind: WorkKind, workId: string, title: string) {
  const t = parseInput(subtaskTitleSchema, title);
  return write(db, async (w) => {
    const last = await w.db.getFirstAsync<{ p: number | null }>(
      `SELECT MAX(position) AS p FROM work_subtasks WHERE ${ALIVE} AND work_kind = ? AND work_id = ?`,
      [kind, workId],
    );
    return w.insert('work_subtasks', {
      work_kind: kind,
      work_id: workId,
      title: t,
      done: 0,
      position: (last?.p ?? -1) + 1,
    });
  });
}

export async function setSubtaskDone(db: Db, id: string, done: boolean) {
  return write(db, (w) => w.update('work_subtasks', id, { done: done ? 1 : 0 }));
}

export async function renameSubtask(db: Db, id: string, title: string) {
  const t = parseInput(subtaskTitleSchema, title);
  return write(db, (w) => w.update('work_subtasks', id, { title: t }));
}

export async function deleteSubtask(db: Db, id: string) {
  return write(db, (w) => w.softDelete('work_subtasks', id));
}

/** Monte ou descend une sous-tâche d'un cran. */
export async function moveSubtask(db: Db, id: string, direction: -1 | 1) {
  return write(db, async (w) => {
    const row = await w.db.getFirstAsync<SubtaskRow>('SELECT * FROM work_subtasks WHERE id = ?', [
      id,
    ]);
    if (!row) return;
    const list = await rowsOf(w.db, row.work_kind as WorkKind, row.work_id);
    const i = list.findIndex((r) => r.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    const order = list.map((r) => r.id);
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    for (const [position, sid] of order.entries()) {
      const current = list.find((r) => r.id === sid);
      if (current && current.position !== position)
        await w.update('work_subtasks', sid, { position });
    }
  });
}

/** Tâche répétée : la suivante reprend la checklist, tout décoché. */
export async function copySubtasks(w: EntityWriter, kind: WorkKind, fromId: string, toId: string) {
  for (const r of await rowsOf(w.db, kind, fromId)) {
    await w.insert('work_subtasks', {
      work_kind: kind,
      work_id: toId,
      title: r.title,
      done: 0,
      position: r.position,
    });
  }
}

export async function deleteSubtasksOf(w: EntityWriter, kind: WorkKind, workId: string) {
  for (const r of await rowsOf(w.db, kind, workId)) await w.softDelete('work_subtasks', r.id);
}
