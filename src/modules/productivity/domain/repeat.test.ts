import { createTestDb } from '@/test/memoryDb';

import { createWorkItem, setWorkStatus, updateWorkItem } from '../data/commands';
import { listWorkItems } from '../data/queries';
import { nextDueDate } from './workItem';

describe('tâches récurrentes', () => {
  it('calcule la prochaine échéance', () => {
    expect(nextDueDate('2026-09-23', 'none')).toBeNull();
    expect(nextDueDate('2026-09-23', 'daily')).toBe('2026-09-24');
    expect(nextDueDate('2026-09-23', 'weekly')).toBe('2026-09-30');
    expect(nextDueDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDueDate('2026-12-15', 'monthly')).toBe('2027-01-15');
  });

  it('crée la suivante quand on termine, une seule fois', async () => {
    const db = await createTestDb();
    const id = await createWorkItem(db, 'task', {
      title: 'Rendre le rapport',
      dueDate: '2026-09-21',
      dueTime: '18:00',
      priority: 'normal',
      status: 'todo',
      reminderAt: '2026-09-21T08:00:00.000Z',
      repeat: 'weekly',
    });
    await setWorkStatus(db, 'task', id, 'done');
    let items = await listWorkItems(db, 'task');
    expect(items).toHaveLength(2);
    const next = items.find((i) => i.id !== id)!;
    expect(next.dueDate).toBe('2026-09-28');
    expect(next.dueTime).toBe('18:00');
    expect(next.status).toBe('todo');
    expect(next.repeat).toBe('weekly');
    expect(next.reminderAt).toBe('2026-09-28T08:00:00.000Z');

    // Re-marquer « terminé » ou modifier une tâche déjà terminée ne crée rien de plus.
    await setWorkStatus(db, 'task', id, 'done');
    await updateWorkItem(db, 'task', id, {
      title: 'Rendre le rapport (v2)',
      dueDate: '2026-09-21',
      priority: 'normal',
      status: 'done',
      repeat: 'weekly',
    });
    items = await listWorkItems(db, 'task');
    expect(items).toHaveLength(2);

    // Une tâche sans répétition ne crée rien.
    const single = await createWorkItem(db, 'task', {
      title: 'Unique',
      dueDate: '2026-09-21',
      priority: 'normal',
      status: 'todo',
    });
    await setWorkStatus(db, 'task', single, 'done');
    expect(await listWorkItems(db, 'task')).toHaveLength(3);
    db.close();
  });
});
