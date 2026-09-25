/**
 * Tests sur une VRAIE base SQLite (en mémoire) : vérifie les requêtes, les contraintes,
 * les transactions et la file de synchronisation.
 */
import {
  createCourse,
  createExam,
  createSubject,
  createTimetable,
  deleteTimetable,
  getSubject,
  listCourseSeries,
  listExams,
  listSubjects,
  updateSubject,
} from '@/modules/academic';
import { createWorkItem, getWorkItem, listWorkItems, setWorkStatus } from '@/modules/productivity';
import { subscribeToChanges, write, type Db } from '@/shared/db';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

import { deleteSubject, subjectUsage } from './deleteSubject';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const outbox = () =>
  db.getAllAsync<{ entity: string; operation: string; base_version: number | null }>(
    'SELECT entity, operation, base_version FROM sync_outbox ORDER BY rowid',
    [],
  );

const mkt = {
  name: 'Marketing stratégique',
  colorId: 'violet',
  teacher: 'Prof. Martin',
  room: 'B12',
};

describe('matières', () => {
  it('crée, relit et modifie une matière, avec une entrée de synchronisation à chaque fois', async () => {
    const id = await createSubject(db, mkt);
    expect((await getSubject(db, id))?.name).toBe('Marketing stratégique');
    await updateSubject(db, id, { ...mkt, room: 'C04' });
    expect((await getSubject(db, id))?.room).toBe('C04');
    expect(await outbox()).toEqual([
      { entity: 'subjects', operation: 'create', base_version: null },
      { entity: 'subjects', operation: 'update', base_version: 0 },
    ]);
  });

  it('un nouvel élément reste « à créer » sur le serveur même après modification', async () => {
    const id = await createSubject(db, mkt);
    await updateSubject(db, id, { ...mkt, name: 'Marketing' });
    const row = await db.getFirstAsync<{ sync_status: string }>(
      'SELECT sync_status FROM subjects WHERE id = ?',
      [id],
    );
    expect(row?.sync_status).toBe('pending_create');
  });

  it('refuse un nom vide sans rien écrire', async () => {
    await expect(createSubject(db, { ...mkt, name: '   ' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await listSubjects(db)).toEqual([]);
    expect(await outbox()).toEqual([]);
  });

  it('prévient les écrans après chaque enregistrement', async () => {
    const seen: string[] = [];
    const stop = subscribeToChanges((t) => seen.push(...t));
    await createSubject(db, mkt);
    stop();
    expect(seen).toEqual(['subjects']);
  });
});

describe('transactions', () => {
  it('si une écriture échoue, rien n’est enregistré (ni données, ni synchronisation)', async () => {
    await expect(
      write(db, async (w) => {
        await w.insert('subjects', { name: 'A', color_id: 'violet' });
        await w.insert('subjects', { name: '', color_id: 'violet' }); // refusé par la base (CHECK)
      }),
    ).rejects.toThrow();
    expect(await listSubjects(db)).toEqual([]);
    expect(await outbox()).toEqual([]);
  });
});

async function seed() {
  const subjectId = await createSubject(db, mkt);
  const timetableId = await createTimetable(db, {
    name: 'Semestre 1',
    validFrom: '2026-09-01',
    validUntil: '2026-12-20',
  });
  await createCourse(db, {
    subjectId,
    timetableId,
    courseType: 'lecture',
    recurrence: 'weekly',
    weekday: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    startTime: '08:00',
    endTime: '10:00',
  });
  await createExam(db, { subjectId, date: '2026-12-15', time: '09:00' });
  const taskId = await createWorkItem(db, 'task', {
    title: 'Réviser',
    subjectId,
    dueDate: '2026-09-30',
    priority: 'normal',
    status: 'todo',
  });
  const assignmentId = await createWorkItem(db, 'assignment', {
    title: 'Étude de cas',
    subjectId,
    dueDate: '2026-09-29',
    priority: 'important',
    status: 'todo',
  });
  return { subjectId, timetableId, taskId, assignmentId };
}

describe('suppression d’une matière (§16)', () => {
  it('compte ce qui est lié avant de supprimer', async () => {
    const { subjectId } = await seed();
    expect(await subjectUsage(db, subjectId)).toEqual({
      courses: 1,
      exams: 1,
      tasks: 1,
      assignments: 1,
      notes: 0,
    });
  });

  it('« garder » : tâches et devoirs restent, sans matière', async () => {
    const { subjectId, taskId, assignmentId } = await seed();
    await deleteSubject(db, subjectId, 'keepWork');
    expect(await listSubjects(db)).toEqual([]);
    expect(await listCourseSeries(db)).toEqual([]);
    expect(await listExams(db)).toEqual([]);
    expect((await getWorkItem(db, 'task', taskId))?.subjectId).toBeNull();
    expect((await getWorkItem(db, 'assignment', assignmentId))?.subjectId).toBeNull();
  });

  it('« tout supprimer » : plus rien de lié', async () => {
    const { subjectId } = await seed();
    await deleteSubject(db, subjectId, 'deleteAll');
    expect(await listWorkItems(db, 'task')).toEqual([]);
    expect(await listWorkItems(db, 'assignment')).toEqual([]);
  });

  it('les suppressions sont synchronisées comme suppressions (architecture §7.4)', async () => {
    const { subjectId } = await seed();
    await deleteSubject(db, subjectId, 'deleteAll');
    const deletes = (await outbox())
      .filter((o) => o.operation === 'delete')
      .map((o) => o.entity)
      .sort();
    expect(deletes).toEqual(['assignments', 'course_series', 'exams', 'subjects', 'tasks']);
  });
});

it('supprimer un emploi du temps supprime ses cours', async () => {
  const { timetableId } = await seed();
  await deleteTimetable(db, timetableId);
  expect(await listCourseSeries(db)).toEqual([]);
});

it('terminer un devoir enregistre la date de complétion (§59), et l’annuler l’efface', async () => {
  const { assignmentId } = await seed();
  await setWorkStatus(db, 'assignment', assignmentId, 'done');
  expect((await getWorkItem(db, 'assignment', assignmentId))?.completedAt).not.toBeNull();
  await setWorkStatus(db, 'assignment', assignmentId, 'todo');
  expect((await getWorkItem(db, 'assignment', assignmentId))?.completedAt).toBeNull();
});

it('la base refuse un cours dont la fin est avant le début, même sans passer par le formulaire', async () => {
  const { subjectId } = await seed();
  await expect(
    write(db, (w) =>
      w.insert('course_series', {
        subject_id: subjectId,
        course_type: 'lecture',
        weekday: 1,
        start_time: '10:00',
        end_time: '09:00',
        valid_from: '2026-09-01',
        valid_until: '2026-12-20',
        recurrence: 'weekly',
      }),
    ),
  ).rejects.toThrow();
});
