import {
  compareWorkItems,
  createWorkItem,
  getWorkItem,
  isOverdue,
  listWorkItems,
  nextOccurrenceInput,
  rescheduleWorkItem,
  setWorkStatus,
  updateWorkItem,
} from '@/modules/productivity';
import { buildToday, calendarDays, type TodayData } from '@/projections';
import { migrate, migrationPreparations, migrations } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

const base = { priority: 'normal', status: 'todo' } as const;

describe('tâches « sans date »', () => {
  it('migration 20 : l’échéance devient facultative sans rien perdre (ids, versions, index)', async () => {
    const db = await createTestDb(19);
    await db.runAsync(
      `INSERT INTO tasks (id, created_at, updated_at, version, sync_status, title, due_date,
         priority, status, reminder_at, repeat_rule, estimated_minutes, space, repeat_parent_id)
       VALUES ('t1', 'c', 'u', 4, 'synced', 'Courses', '2026-10-01', 'urgent', 'todo',
         '2026-09-30T17:00:00.000Z', 'weekly', 30, 'work', 'p0')`,
      [],
    );
    await db.runAsync(
      `INSERT INTO assignments (id, created_at, updated_at, version, sync_status, title, due_date,
         priority, status) VALUES ('a1', 'c', 'u', 2, 'pending_update', 'TP', '2026-10-02',
         'normal', 'done')`,
      [],
    );
    await migrate(db, migrations, migrationPreparations);

    expect(await db.getFirstAsync('SELECT * FROM tasks WHERE id = ?', ['t1'])).toMatchObject({
      version: 4,
      sync_status: 'synced',
      due_date: '2026-10-01',
      priority: 'urgent',
      reminder_at: '2026-09-30T17:00:00.000Z',
      repeat_rule: 'weekly',
      estimated_minutes: 30,
      space: 'work',
      repeat_parent_id: 'p0',
    });
    expect(await db.getFirstAsync('SELECT * FROM assignments WHERE id = ?', ['a1'])).toMatchObject({
      version: 2,
      sync_status: 'pending_update',
      status: 'done',
      space: 'study',
    });
    for (const table of ['tasks', 'assignments']) {
      const cols = await db.getAllAsync<{ name: string; notnull: number }>(
        `PRAGMA table_info(${table})`,
        [],
      );
      expect(cols.find((c) => c.name === 'due_date')?.notnull).toBe(0);
      const indexes = await db.getAllAsync<{ name: string }>(`PRAGMA index_list(${table})`, []);
      expect(
        indexes
          .map((i) => i.name)
          .filter((n) => n.startsWith('idx_'))
          .sort(),
      ).toEqual([`idx_${table}_due`, `idx_${table}_repeat_parent`].sort());
    }
    db.close();
  });

  it('se crée, se modifie et se trie sans date ; jamais « en retard »', async () => {
    const db = await createTestDb();
    const free = await createWorkItem(db, 'task', { ...base, title: 'Lire un livre' });
    const dated = await createWorkItem(db, 'task', {
      ...base,
      title: 'Payer le loyer',
      dueDate: '2026-09-20',
    });
    const item = (await getWorkItem(db, 'task', free))!;
    expect(item.dueDate).toBeNull();
    expect(isOverdue(item, new Date(2030, 0, 1))).toBe(false);
    // Avec une date (même passée) d'abord, sans date à la fin.
    const sorted = (await listWorkItems(db, 'task')).sort(compareWorkItems);
    expect(sorted.map((w) => w.id)).toEqual([dated, free]);

    // Effacer la date d'une tâche datée la retire vraiment (pas remise à aujourd'hui).
    const d = (await getWorkItem(db, 'task', dated))!;
    await updateWorkItem(db, 'task', dated, { ...d, dueDate: null });
    expect((await getWorkItem(db, 'task', dated))?.dueDate).toBeNull();

    // Reporter puis annuler : la tâche redevient sans date.
    await rescheduleWorkItem(db, 'task', free, '2026-10-05');
    expect((await getWorkItem(db, 'task', free))?.dueDate).toBe('2026-10-05');
    await rescheduleWorkItem(db, 'task', free, null);
    expect((await getWorkItem(db, 'task', free))?.dueDate).toBeNull();
    db.close();
  });

  it('Aujourd’hui et le calendrier l’ignorent ; une tâche répétée repart du jour terminé', async () => {
    const db = await createTestDb();
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Sport',
      repeat: 'daily',
    });
    const w = (await getWorkItem(db, 'task', id))!;
    const now = new Date(2026, 9, 10, 12, 0);
    const data: TodayData = { series: [], exams: [], work: [w], events: [] };
    const view = buildToday(data, now);
    expect(view.overdue).toEqual([]);
    expect(view.dueToday).toEqual([]);
    const items = [...calendarDays(data, '2026-10-01', '2026-10-31').values()].flat();
    expect(items).toEqual([]);

    expect(nextOccurrenceInput(w, '2026-10-10')?.dueDate).toBe('2026-10-11');
    // Terminer crée la suivante (datée du lendemain du jour où elle est terminée).
    await setWorkStatus(db, 'task', id, 'done');
    const all = await listWorkItems(db, 'task');
    expect(all).toHaveLength(2);
    db.close();
  });
});
