import { createCourse, createExam, createSubject } from '@/modules/academic';
import { createTransaction } from '@/modules/finance';
import { setActiveSpaces } from '@/modules/identity';
import { createNote, createWorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import { countResults, searchAll } from './search';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

it('retrouve une matière, ses cours, notes, devoirs et examens avec un seul mot (§83)', async () => {
  const subjectId = await createSubject(db, { name: 'Marketing stratégique', colorId: 'violet' });
  await createCourse(db, {
    subjectId,
    courseType: 'lecture',
    recurrence: 'weekly',
    weekday: 1,
    startDate: '2026-09-07',
    endDate: '2026-12-14',
    startTime: '08:00',
    endTime: '10:00',
  });
  await createNote(db, { title: 'Cours Marketing — 12 septembre', content: 'Les 4P', subjectId });
  await createWorkItem(db, 'assignment', {
    title: 'Étude de cas Marketing',
    dueDate: '2026-09-29',
    priority: 'normal',
    status: 'todo',
    subjectId,
  });
  await createExam(db, { subjectId, date: '2026-12-15' });
  await createSubject(db, { name: 'Finance', colorId: 'teal' });

  const r = await searchAll(db, 'marketing');
  expect(r.subjects.map((s) => s.name)).toEqual(['Marketing stratégique']);
  expect(r.courses).toHaveLength(1);
  expect(r.notes).toHaveLength(1);
  expect(r.assignments).toHaveLength(1);
  expect(r.exams).toHaveLength(1);
  expect(countResults(r)).toBe(5);
});

it('ignore les requêtes trop courtes et les jokers SQL', async () => {
  await createSubject(db, { name: 'Finance', colorId: 'teal' });
  expect(countResults(await searchAll(db, 'f'))).toBe(0);
  expect(countResults(await searchAll(db, '%%'))).toBe(0);
  expect(countResults(await searchAll(db, 'fin'))).toBe(1);
});

it('trouve les opérations d’argent par leur note, seulement si l’espace Perso est actif', async () => {
  await createTransaction(db, {
    kind: 'expense',
    amountMinor: 2500,
    currency: 'XAF',
    date: '2026-09-20',
    categoryId: 'food',
    note: 'Pizza anniversaire',
  });
  await setActiveSpaces(db, ['study', 'personal']);
  const r = await searchAll(db, 'pizza');
  expect(r.transactions.map((x) => x.note)).toEqual(['Pizza anniversaire']);
  expect(countResults(r)).toBe(1);

  await setActiveSpaces(db, ['study', 'work']);
  const hidden = await searchAll(db, 'pizza');
  expect(hidden.transactions).toEqual([]);
  expect(countResults(hidden)).toBe(0);
});
