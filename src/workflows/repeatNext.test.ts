import { createSubject } from '@/modules/academic';
import { createWorkItem, listWorkItems, setWorkStatus } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const daily = {
  title: 'Exercices',
  dueDate: '2026-11-07',
  priority: 'normal',
  status: 'todo',
  repeat: 'daily',
} as const;

describe('tâche répétée : la suivante', () => {
  it('deux tâches de même titre dans deux matières créent chacune leur suivante, sans doublon', async () => {
    const maths = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const physique = await createSubject(db, { name: 'Physique', colorId: 'green' });
    const a = await createWorkItem(db, 'assignment', { ...daily, subjectId: maths });
    const b = await createWorkItem(db, 'assignment', { ...daily, subjectId: physique });

    const nextA = await setWorkStatus(db, 'assignment', a, 'done');
    const nextB = await setWorkStatus(db, 'assignment', b, 'done');
    expect(nextA).not.toBeNull();
    expect(nextB).not.toBeNull();

    const tomorrow = (await listWorkItems(db, 'assignment')).filter(
      (w) => w.dueDate === '2026-11-08',
    );
    expect(tomorrow.map((w) => w.subjectId).sort()).toEqual([maths, physique].sort());

    // Cocher, décocher, recocher : pas de nouvelle occurrence.
    await setWorkStatus(db, 'assignment', a, 'todo');
    expect(await setWorkStatus(db, 'assignment', a, 'done')).toBeNull();
    expect(
      (await listWorkItems(db, 'assignment')).filter((w) => w.dueDate === '2026-11-08'),
    ).toHaveLength(2);

    const row = await db.getFirstAsync<{ repeat_parent_id: string | null }>(
      'SELECT repeat_parent_id FROM assignments WHERE id = ?',
      [nextA],
    );
    expect(row?.repeat_parent_id).toBe(a);
  });

  it('une tâche créée à la main avec le même titre n’empêche pas la suivante', async () => {
    const a = await createWorkItem(db, 'task', daily);
    await createWorkItem(db, 'task', { ...daily, dueDate: '2026-11-08', repeat: 'daily' });
    expect(await setWorkStatus(db, 'task', a, 'done')).not.toBeNull();
    expect(
      (await listWorkItems(db, 'task')).filter((w) => w.dueDate === '2026-11-08'),
    ).toHaveLength(2);
  });
});
