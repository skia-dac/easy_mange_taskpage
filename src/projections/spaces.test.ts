import { migrate, migrations } from '@/shared/db';
import { getActiveSpaces, setActiveSpaces } from '@/modules/identity';
import {
  createPersonalEvent,
  createWorkItem,
  getPersonalEvent,
  getWorkItem,
  listWorkItems,
  updatePersonalEvent,
  updateWorkItem,
  workSpace,
} from '@/modules/productivity';
import { defaultSpace, normalizeSpaces, toggleSpace } from '@/shared/spaces';
import { createTestDb } from '@/test/memoryDb';

import { glanceTiles } from './glance';
import { filterBySpaces } from './spaces';
import type { TodayData } from './today';

const task = {
  title: 'Rapport mensuel',
  dueDate: '2026-09-25',
  priority: 'normal' as const,
  status: 'todo' as const,
};

describe('espaces : règles', () => {
  it('toujours au moins un espace actif', () => {
    expect(toggleSpace(['work'], 'work', false)).toEqual(['work']);
    expect(toggleSpace(['study', 'work'], 'study', false)).toEqual(['work']);
    expect(toggleSpace(['work'], 'personal', true)).toEqual(['work', 'personal']);
    expect(normalizeSpaces([])).toEqual(['study', 'personal']);
    expect(normalizeSpaces(['personal', 'study', 'x', 'study'])).toEqual(['study', 'personal']);
    expect(defaultSpace(['study'])).toBe('study');
    expect(defaultSpace(['study', 'work'])).toBe('work');
  });

  it('réglage : Études + Perso par défaut, liste vide refusée', async () => {
    const db = await createTestDb();
    expect(await getActiveSpaces(db)).toEqual(['study', 'personal']);
    await setActiveSpaces(db, ['work']);
    expect(await getActiveSpaces(db)).toEqual(['work']);
    await expect(setActiveSpaces(db, [])).rejects.toThrow();
    expect(await getActiveSpaces(db)).toEqual(['work']);
    db.close();
  });

  it('les 4 tuiles suivent les espaces', () => {
    expect(glanceTiles(['work'])).toEqual(['todo', 'plan', 'meetings', 'doneWeek']);
    expect(glanceTiles(['study'])).toEqual(['courses', 'exam', 'todo', 'revision']);
    expect(glanceTiles(['personal'])).toEqual(['money', 'habits', 'todo', 'due']);
    expect(glanceTiles(['study', 'personal'])).toEqual(['money', 'habits', 'todo', 'exam']);
    expect(glanceTiles(['work', 'personal'])).toEqual(['money', 'habits', 'todo', 'plan']);
    expect(glanceTiles(['study', 'work'])).toEqual(['todo', 'exam', 'plan', 'courses']);
    expect(glanceTiles(['study', 'work', 'personal'])).toEqual(['money', 'habits', 'todo', 'exam']);
  });
});

describe('espaces : aucune donnée perdue ni écrasée', () => {
  it('une modification sans espace garde celui enregistré', async () => {
    const db = await createTestDb();
    const id = await createWorkItem(db, 'task', { ...task, space: 'work' });
    await updateWorkItem(db, 'task', id, { ...task, title: 'Rapport (v2)' });
    expect((await getWorkItem(db, 'task', id))?.space).toBe('work');

    const ev = await createPersonalEvent(db, {
      title: 'Réunion',
      date: '2026-09-25',
      space: 'work',
    });
    await updatePersonalEvent(db, ev, { title: 'Réunion client', date: '2026-09-25' });
    expect((await getPersonalEvent(db, ev))?.space).toBe('work');

    db.close();
  });

  it('un devoir ou un élément lié à une matière est rangé dans Études', async () => {
    const db = await createTestDb();
    await db.runAsync(
      "INSERT INTO subjects (id, created_at, updated_at, name, color_id) VALUES ('mkt', '', '', 'Marketing', 'violet')",
      [],
    );
    const a = await createWorkItem(db, 'assignment', { ...task, space: 'personal' });
    const t = await createWorkItem(db, 'task', { ...task, subjectId: 'mkt', space: 'work' });
    expect((await getWorkItem(db, 'assignment', a))?.space).toBe('study');
    const saved = await getWorkItem(db, 'task', t);
    expect(saved?.space).toBe('study');
    expect(saved && workSpace(saved)).toBe('study');
    db.close();
  });

  it('migration : les anciennes données reçoivent un espace, rien ne disparaît', async () => {
    const db = await createTestDb(11);
    await db.runAsync(
      "INSERT INTO subjects (id, created_at, updated_at, name, color_id) VALUES ('mkt', '', '', 'Marketing', 'violet')",
      [],
    );
    const insert = (id: string, subject: string | null) =>
      db.runAsync(
        `INSERT INTO tasks (id, created_at, updated_at, title, subject_id, due_date, priority, status)
         VALUES (?, '', '', ?, ?, '2026-09-25', 'normal', 'todo')`,
        [id, id, subject],
      );
    await insert('perso', null);
    await insert('cours', 'mkt');
    await migrate(db, migrations);
    const items = await listWorkItems(db, 'task');
    expect(items.map((i) => [i.id, i.space]).sort()).toEqual([
      ['cours', 'study'],
      ['perso', 'personal'],
    ]);
    db.close();
  });

  it('couper un espace cache ses données sans les modifier, le réactiver les rend', () => {
    const data: TodayData = {
      series: [],
      exams: [],
      events: [
        {
          id: 'w',
          title: 'Réunion',
          date: '2026-09-25',
          startTime: null,
          endTime: null,
          description: null,
          reminderAt: null,
          space: 'work',
        },
        {
          id: 'p',
          title: 'Anniversaire',
          date: '2026-09-25',
          startTime: null,
          endTime: null,
          description: null,
          reminderAt: null,
          space: 'personal',
        },
      ],
      work: [],
      habits: [],
      money: { recurring: [], payments: [] },
    };
    const hidden = filterBySpaces(data, ['work']);
    expect(hidden.events.map((e) => e.id)).toEqual(['w']);
    expect(hidden.money).toBeUndefined();
    expect(data.events).toHaveLength(2);
    expect(filterBySpaces(data, ['work', 'personal']).events).toHaveLength(2);
  });
});
