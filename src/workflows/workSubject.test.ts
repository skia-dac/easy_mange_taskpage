import { createSubject } from '@/modules/academic';
import {
  createWorkItem,
  getWorkItem,
  listWorkItems,
  updateWorkItem,
  type WorkItemInput,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const base: WorkItemInput = {
  title: 'Exposé',
  dueDate: '2026-11-10',
  priority: 'normal',
  status: 'todo',
};

async function outbox() {
  return db.getAllAsync<{ entity: string; entity_id: string; operation: string }>(
    'SELECT entity, entity_id, operation FROM sync_outbox ORDER BY created_at, rowid',
    [],
  );
}

describe('fiche tâche : ajouter ou retirer la matière', () => {
  it('retirer la matière d’un devoir : même élément (même id), une seule modification envoyée', async () => {
    const maths = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const id = await createWorkItem(db, 'assignment', { ...base, subjectId: maths });
    await db.runAsync('DELETE FROM sync_outbox', []);

    await updateWorkItem(db, 'assignment', id, { ...base, subjectId: null });
    expect(await getWorkItem(db, 'assignment', id)).toMatchObject({ id, subjectId: null });
    expect(await listWorkItems(db, 'assignment', { subjectId: maths })).toHaveLength(0);
    expect(await outbox()).toEqual([{ entity: 'assignments', entity_id: id, operation: 'update' }]);
  });

  it('ajouter une matière à une tâche : elle apparaît dans la matière, sans changer de table', async () => {
    const maths = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const id = await createWorkItem(db, 'task', base);
    await db.runAsync('DELETE FROM sync_outbox', []);

    await updateWorkItem(db, 'task', id, { ...base, subjectId: maths });
    expect((await listWorkItems(db, 'task', { subjectId: maths })).map((w) => w.id)).toEqual([id]);
    expect(await outbox()).toEqual([{ entity: 'tasks', entity_id: id, operation: 'update' }]);

    // Et la retirer de nouveau.
    await updateWorkItem(db, 'task', id, { ...base, subjectId: null });
    expect(await getWorkItem(db, 'task', id)).toMatchObject({ subjectId: null });
  });
});
