import {
  addSubtask,
  createPersonalEvents,
  createWorkItem,
  deletePersonalEvents,
  deleteSubtask,
  deleteWorkItem,
  listPersonalEvents,
  listSubtasks,
  listWorkItems,
  moveSubtask,
  rescheduleWorkItems,
  restoreWorkDates,
  setWorkStatus,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const task = {
  title: 'Relire le cours',
  dueDate: '2026-09-24',
  dueTime: '18:00',
  priority: 'normal',
  status: 'todo',
  reminderAt: '2026-09-24T07:00:00.000Z',
} as const;

describe('lot D — bilan du soir et planning', () => {
  it('« Tout reporter » en une transaction, et « Annuler » remet les échéances', async () => {
    const a = await createWorkItem(db, 'task', task);
    const b = await createWorkItem(db, 'assignment', { ...task, dueDate: '2026-09-23' });
    const previous = await rescheduleWorkItems(
      db,
      [
        { kind: 'task', id: a },
        { kind: 'assignment', id: b },
      ],
      '2026-09-25',
    );
    expect((await listWorkItems(db, 'task'))[0]).toMatchObject({
      dueDate: '2026-09-25',
      dueTime: '18:00',
      reminderAt: '2026-09-25T07:00:00.000Z',
    });
    expect((await listWorkItems(db, 'assignment'))[0]?.dueDate).toBe('2026-09-25');
    await restoreWorkDates(db, previous);
    expect((await listWorkItems(db, 'task'))[0]).toMatchObject({
      dueDate: '2026-09-24',
      reminderAt: '2026-09-24T07:00:00.000Z',
    });
    expect((await listWorkItems(db, 'assignment'))[0]?.dueDate).toBe('2026-09-23');
  });

  it('« Tout reporter » : un élément introuvable annule toute la transaction', async () => {
    const a = await createWorkItem(db, 'task', task);
    await expect(
      rescheduleWorkItems(
        db,
        [
          { kind: 'task', id: a },
          { kind: 'task', id: 'absent' },
        ],
        '2026-09-25',
      ),
    ).rejects.toBeDefined();
    expect((await listWorkItems(db, 'task'))[0]?.dueDate).toBe('2026-09-24');
  });

  it('« Copier la semaine » crée tout en une transaction ; « Annuler » supprime tout', async () => {
    const ids = await createPersonalEvents(db, [
      {
        title: 'Stand-up',
        date: '2026-09-28',
        startTime: '09:00',
        endTime: '09:15',
        space: 'work',
      },
      { title: 'Revue', date: '2026-09-30', startTime: '14:00', endTime: '15:00', space: 'work' },
    ]);
    expect(ids).toHaveLength(2);
    expect(await listPersonalEvents(db)).toHaveLength(2);
    await deletePersonalEvents(db, ids);
    expect(await listPersonalEvents(db)).toHaveLength(0);
  });

  it('les lectures par id ignorent les lignes supprimées', async () => {
    const id = await createWorkItem(db, 'task', { ...task, repeat: 'weekly' });
    const s1 = await addSubtask(db, 'task', id, 'A');
    const s2 = await addSubtask(db, 'task', id, 'B');
    await deleteSubtask(db, s1);
    // Déplacer une sous-tâche supprimée ne touche pas l'ordre des autres.
    await moveSubtask(db, s1, 1);
    expect((await listSubtasks(db, 'task', id)).map((s) => s.id)).toEqual([s2]);
    // Terminer une tâche supprimée est refusé, et ne crée pas d'occurrence suivante.
    await deleteWorkItem(db, 'task', id);
    await expect(setWorkStatus(db, 'task', id, 'done')).rejects.toBeDefined();
    expect(await listWorkItems(db, 'task')).toHaveLength(0);
  });
});
