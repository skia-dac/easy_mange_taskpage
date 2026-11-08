import { createTestDb } from '@/test/memoryDb';

import { createWorkItem } from './commands';
import { listWorkItemsSince } from './queries';

describe('tâches de l’agenda à partir d’une date', () => {
  it('garde tout ce qui reste à faire, et les terminées seulement dans la fenêtre', async () => {
    const db = await createTestDb();
    const base = { priority: 'normal', status: 'todo' } as const;
    const ids = {
      openUndated: await createWorkItem(db, 'task', { ...base, title: 'Sans date', dueDate: null }),
      openOld: await createWorkItem(db, 'task', {
        ...base,
        title: 'Ancienne',
        dueDate: '2020-01-01',
      }),
      doneUndatedOld: await createWorkItem(db, 'task', {
        ...base,
        title: 'Finie il y a longtemps',
        dueDate: null,
        status: 'done',
      }),
      doneUndatedRecent: await createWorkItem(db, 'task', {
        ...base,
        title: 'Finie récemment',
        dueDate: null,
        status: 'done',
      }),
      doneOld: await createWorkItem(db, 'task', {
        ...base,
        title: 'Vieille terminée',
        dueDate: '2020-01-01',
        status: 'done',
      }),
      doneInWindow: await createWorkItem(db, 'task', {
        ...base,
        title: 'Terminée datée',
        dueDate: '2026-10-05',
        status: 'done',
      }),
    };
    // Dates de fin : l'une bien avant la fenêtre, les autres dedans.
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id IN (?, ?)', [
      '2021-03-01T10:00:00.000Z',
      ids.doneUndatedOld,
      ids.doneOld,
    ]);
    await db.runAsync('UPDATE tasks SET completed_at = ? WHERE id IN (?, ?)', [
      '2026-10-03T10:00:00.000Z',
      ids.doneUndatedRecent,
      ids.doneInWindow,
    ]);

    const got = new Set((await listWorkItemsSince(db, 'task', '2026-10-01')).map((w) => w.id));
    expect(got).toEqual(
      new Set([ids.openUndated, ids.openOld, ids.doneUndatedRecent, ids.doneInWindow]),
    );
    // Un terminé sans date d'il y a longtemps n'est plus relu.
    expect(got.has(ids.doneUndatedOld)).toBe(false);
    expect(got.has(ids.doneOld)).toBe(false);
    db.close();
  });
});
