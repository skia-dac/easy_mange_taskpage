import {
  cancelOccurrence,
  countAffectedOccurrences,
  createCourse,
  createOffPeriod,
  createSubject,
  createTimetable,
  getCourseException,
  getCourseSeries,
  listCourseExceptions,
  listCourseSeries,
  listOffPeriods,
  listTimetables,
  overrideOccurrence,
} from '@/modules/academic';
import {
  createLoan,
  createRecurring,
  createTransaction,
  deleteLoan,
  deleteRecurring,
  listLoans,
  listRecurring,
  listTransactions,
} from '@/modules/finance';
import {
  createCheckpoint,
  createHabit,
  createNote,
  createNoteCategory,
  createPersonalEvent,
  createSlot,
  createWorkItem,
  deleteCheckpoint,
  deleteSlot,
  getNote,
  getPersonalEvent,
  getWorkItem,
  listCheckpoints,
  listNotes,
  listHabits,
  listSlots,
  setHabitDone,
  setNoteCategory,
} from '@/modules/productivity';
import type { CalendarItem } from '@/projections';
import { calendarItemKey } from '@/components/CalendarItemRow';
import type { Db } from '@/shared/db';
import { AppError, userMessageKey } from '@/shared/errors';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

import {
  deleteCourseEverywhere,
  deleteTimetableEverywhere,
  endCourseSeriesEverywhere,
  splitSeriesEverywhere,
} from './deleteCourse';
import { deleteHabitEverywhere } from './deleteHabit';
import { moveCalendarItem } from './moveItem';
import { wipeAllData } from './wipeAllData';

const deleted: string[] = [];
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  deleteLocalFile: (p: string) => deleted.push(p),
  cancelAllReminders: async () => undefined,
  deleteAllAttachments: () => undefined,
  deleteAllBackups: () => undefined,
}));

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
  deleted.length = 0;
});
afterEach(() => db.close());

describe('suppressions en cascade et déplacements', () => {
  it('supprimer un cours efface aussi ses exceptions', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, {
      subjectId,
      courseType: 'lecture',
      recurrence: 'weekly',
      weekday: 1,
      startDate: '2026-09-07',
      endDate: '2026-12-14',
      startTime: '08:00',
      endTime: '10:00',
    });
    await cancelOccurrence(db, seriesId, '2026-09-21');
    const noteId = await createNote(db, {
      title: 'Cours 1',
      content: 'x',
      subjectId,
      courseSeriesId: seriesId,
      courseDate: '2026-09-14',
    });
    expect(await listCourseExceptions(db)).toHaveLength(1);
    await deleteCourseEverywhere(db, seriesId);
    expect(await listCourseSeries(db)).toEqual([]);
    expect(await listCourseExceptions(db)).toEqual([]);
    // La note reste, détachée du cours (elle garde sa matière).
    expect(await getNote(db, noteId)).toMatchObject({ courseSeriesId: null, subjectId });
  });

  it('supprimer un créneau ; un créneau inconnu est refusé', async () => {
    const id = await createSlot(db, {
      title: 'Bureau',
      weekdays: [1, 2],
      startTime: '08:00',
      endTime: '17:00',
      validFrom: '2026-09-01',
    });
    expect(await listSlots(db)).toHaveLength(1);
    await deleteSlot(db, id);
    expect(await listSlots(db)).toEqual([]);
    await expect(deleteSlot(db, id)).rejects.toBeInstanceOf(AppError);
  });

  it('change la catégorie d’une note sans toucher au reste', async () => {
    const cat = await createNoteCategory(db, { name: 'Idées', colorId: 'blue' });
    const id = await createNote(db, { title: 'A', content: 'texte' });
    await setNoteCategory(db, id, cat);
    expect((await getNote(db, id))?.categoryId).toBe(cat);
    expect((await getNote(db, id))?.content).toBe('texte');
    await setNoteCategory(db, id, null);
    expect((await getNote(db, id))?.categoryId).toBeNull();
  });

  it('supprime un point de suivi, puis une habitude avec ses logs, points et photos', async () => {
    const habitId = await createHabit(db, { name: 'Sport', tracksBody: true });
    const first = await createCheckpoint(db, {
      habitId,
      date: '2026-09-01',
      weightKg: 80,
      photoPath: 'attachments/progress/h/a.jpg',
    });
    const second = await createCheckpoint(db, {
      habitId,
      date: '2026-09-15',
      weightKg: 79,
      photoPath: 'attachments/progress/h/b.jpg',
    });
    await deleteCheckpoint(db, second);
    expect((await listCheckpoints(db, habitId)).map((c) => c.id)).toEqual([first]);

    await setHabitDone(db, habitId, '2026-09-20', true);
    await deleteHabitEverywhere(db, habitId);
    expect(await listHabits(db)).toEqual([]);
    expect(await listCheckpoints(db, habitId)).toEqual([]);
    expect(deleted).toEqual(['attachments/progress/h/a.jpg']);
    const logs = await db.getAllAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM habit_logs WHERE habit_id = ? AND deleted_at IS NULL',
      [habitId],
    );
    expect(logs[0]?.n).toBe(0);
  });

  it('supprimer un prêt efface ses mouvements ; une charge fixe garde les paiements notés', async () => {
    const loanId = await createLoan(
      db,
      { direction: 'lent', person: 'Ali' },
      { amountMinor: 10_000, currency: 'XAF', date: '2026-09-01' },
    );
    expect(await listTransactions(db)).toHaveLength(1);
    await deleteLoan(db, loanId);
    expect(await listLoans(db)).toEqual([]);
    expect(await listTransactions(db)).toEqual([]);

    const recId = await createRecurring(db, {
      kind: 'charge',
      name: 'Loyer',
      amountMinor: 50_000,
      currency: 'XAF',
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-09-01',
    });
    await createTransaction(db, {
      kind: 'expense',
      amountMinor: 50_000,
      currency: 'XAF',
      date: '2026-09-05',
      recurringId: recId,
      occurrenceDate: '2026-09-05',
    });
    await deleteRecurring(db, recId);
    expect(await listRecurring(db)).toEqual([]);
    const kept = await listTransactions(db);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.recurringId).toBeNull();
  });

  it('déplace une tâche, un rendez-vous (avec son rappel) et une séance de cours', async () => {
    const taskId = await createWorkItem(db, 'task', {
      title: 'Rapport',
      dueDate: '2026-09-23',
      dueTime: '10:00',
      priority: 'normal',
      status: 'todo',
    });
    const task = (await getWorkItem(db, 'task', taskId))!;
    await moveCalendarItem(
      db,
      { kind: 'work', sortTime: '10:00', item: task },
      { date: '2026-09-24', startTime: '14:00', endTime: '15:00' },
    );
    expect(await getWorkItem(db, 'task', taskId)).toMatchObject({
      dueDate: '2026-09-24',
      dueTime: '15:00',
    });

    const eventId = await createPersonalEvent(db, {
      title: 'Dentiste',
      date: '2026-09-23',
      startTime: '09:00',
      endTime: '10:00',
      reminderAt: '2026-09-23T08:30:00.000Z',
    });
    const event = (await getPersonalEvent(db, eventId))!;
    await moveCalendarItem(
      db,
      { kind: 'event', sortTime: '09:00', event },
      { date: '2026-09-24', startTime: '11:00', endTime: '12:00' },
    );
    const moved = (await getPersonalEvent(db, eventId))!;
    expect(moved).toMatchObject({ date: '2026-09-24', startTime: '11:00', endTime: '12:00' });
    // Le rappel suit le décalage (+1 jour, +2 h).
    expect(moved.reminderAt).toBe('2026-09-24T10:30:00.000Z');

    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, {
      subjectId,
      courseType: 'lecture',
      recurrence: 'weekly',
      weekday: 3,
      startDate: '2026-09-02',
      endDate: '2026-12-16',
      startTime: '08:00',
      endTime: '10:00',
    });
    await moveCalendarItem(
      db,
      {
        kind: 'course',
        sortTime: '08:00',
        occurrence: {
          seriesId,
          subjectId,
          originalDate: '2026-09-23',
          date: '2026-09-23',
          startTime: '08:00',
          endTime: '10:00',
          title: null,
          room: null,
          teacher: null,
          courseType: 'lecture',
          recurrence: 'weekly',
          status: 'normal',
          exceptionId: null,
          note: null,
        },
      },
      { date: '2026-09-24', startTime: '14:00', endTime: '16:00' },
    );
    expect(await getCourseException(db, seriesId, '2026-09-23')).toMatchObject({
      kind: 'modified',
      newDate: '2026-09-24',
      newStartTime: '14:00',
      newEndTime: '16:00',
    });
  });

  it('« Supprimer toutes mes données » vide la base', async () => {
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await createNote(db, { title: 'A', content: 'x' });
    await wipeAllData(db);
    const rows = await db.getAllAsync<{ n: number }>(
      'SELECT (SELECT COUNT(*) FROM subjects) + (SELECT COUNT(*) FROM notes) + (SELECT COUNT(*) FROM app_settings) AS n',
      [],
    );
    expect(rows[0]?.n).toBe(0);
  });
});

const weekly = (subjectId: string, timetableId: string | null = null) => ({
  subjectId,
  timetableId,
  courseType: 'lecture' as const,
  recurrence: 'weekly' as const,
  weekday: 1,
  startDate: '2026-09-07',
  endDate: '2026-12-14',
  startTime: '08:00',
  endTime: '10:00',
});

const courseItem = (seriesId: string, subjectId: string, date: string): CalendarItem => ({
  kind: 'course',
  sortTime: '08:00',
  occurrence: {
    seriesId,
    subjectId,
    originalDate: date,
    date,
    startTime: '08:00',
    endTime: '10:00',
    title: null,
    room: null,
    teacher: null,
    courseType: 'lecture',
    recurrence: 'weekly',
    status: 'normal',
    exceptionId: null,
    note: null,
  },
});

describe('cascades des cours (audit #4)', () => {
  it('supprimer un emploi du temps efface ses cours et leurs exceptions, détache les notes', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const timetableId = await createTimetable(db, {
      name: 'S1',
      kind: 'courses',
      validFrom: '2026-09-01',
      validUntil: '2026-12-31',
    });
    const seriesId = await createCourse(db, weekly(subjectId, timetableId));
    await cancelOccurrence(db, seriesId, '2026-09-21');
    const noteId = await createNote(db, {
      title: 'Cours 1',
      content: 'x',
      subjectId,
      courseSeriesId: seriesId,
      courseDate: '2026-09-14',
    });
    await deleteTimetableEverywhere(db, timetableId);
    expect(await listTimetables(db)).toEqual([]);
    expect(await listCourseSeries(db)).toEqual([]);
    expect(await listCourseExceptions(db)).toEqual([]);
    expect(await getNote(db, noteId)).toMatchObject({ courseSeriesId: null, subjectId });
  });

  it('« ce cours et les suivants » dès la première séance supprime toute la série proprement', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, weekly(subjectId));
    await cancelOccurrence(db, seriesId, '2026-09-21');
    const noteId = await createNote(db, {
      title: 'Cours 1',
      content: 'x',
      courseSeriesId: seriesId,
      courseDate: '2026-09-14',
    });
    await endCourseSeriesEverywhere(db, seriesId, '2026-09-07');
    expect(await listCourseSeries(db)).toEqual([]);
    expect(await listCourseExceptions(db)).toEqual([]);
    expect((await getNote(db, noteId))?.courseSeriesId).toBeNull();

    // Plus tard dans la série : la série s'arrête la veille, les notes d'avant restent rattachées.
    const second = await createCourse(db, weekly(subjectId));
    const kept = await createNote(db, {
      title: 'Avant',
      content: 'x',
      courseSeriesId: second,
      courseDate: '2026-09-14',
    });
    await endCourseSeriesEverywhere(db, second, '2026-10-05');
    expect((await getCourseSeries(db, second))?.validUntil).toBe('2026-10-04');
    expect((await getNote(db, kept))?.courseSeriesId).toBe(second);
  });

  it('couper une série fait suivre les notes prises à partir de la date de coupure', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, weekly(subjectId));
    const before = await createNote(db, {
      title: 'Avant',
      content: 'x',
      courseSeriesId: seriesId,
      courseDate: '2026-09-14',
    });
    const after = await createNote(db, {
      title: 'Après',
      content: 'x',
      courseSeriesId: seriesId,
      courseDate: '2026-10-12',
    });
    const newId = await splitSeriesEverywhere(db, seriesId, '2026-10-05', {
      ...weekly(subjectId),
      room: 'B12',
    });
    expect(newId).not.toBe(seriesId);
    expect((await getNote(db, before))?.courseSeriesId).toBe(seriesId);
    expect((await getNote(db, after))?.courseSeriesId).toBe(newId);
    // La requête filtrée sur le cours / la séance ne renvoie que les bonnes notes.
    expect((await listNotes(db, { courseSeriesId: newId })).map((n) => n.id)).toEqual([after]);
    expect(
      (await listNotes(db, { courseSeriesId: seriesId, courseDate: '2026-09-14' })).map(
        (n) => n.id,
      ),
    ).toEqual([before]);
  });
});

describe('séances modifiées et jours off (audit #10)', () => {
  it('refuse une fin de séance avant le début effectif de la série', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, weekly(subjectId));
    const attempt = overrideOccurrence(db, { seriesId, date: '2026-09-14', newEndTime: '07:30' });
    await expect(attempt).rejects.toBeInstanceOf(ValidationError);
    await expect(attempt).rejects.toMatchObject({
      fields: { newEndTime: 'validation.endAfterStart' },
    });
    await expect(
      overrideOccurrence(db, { seriesId, date: '2026-09-14', newStartTime: '11:00' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await overrideOccurrence(db, { seriesId, date: '2026-09-14', newEndTime: '09:00' });
    expect((await getCourseException(db, seriesId, '2026-09-14'))?.newEndTime).toBe('09:00');
  });

  it('refuse de déplacer une séance sur un jour off suspendu, avec un message clair', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, weekly(subjectId));
    await createOffPeriod(db, {
      name: 'Toussaint',
      kind: 'holiday',
      startDate: '2026-10-19',
      endDate: '2026-10-25',
      suspendCourses: true,
    });
    await createOffPeriod(db, {
      name: 'Pont',
      kind: 'day_off',
      startDate: '2026-11-11',
      endDate: '2026-11-11',
      suspendCourses: false,
    });
    const target = { startTime: '14:00', endTime: '16:00' };
    const refused = moveCalendarItem(db, courseItem(seriesId, subjectId, '2026-10-12'), {
      date: '2026-10-21',
      ...target,
    });
    await expect(refused).rejects.toBeInstanceOf(AppError);
    await refused.catch((e: unknown) => expect(userMessageKey(e)).toBe('calendar.moveOnDayOff'));
    expect(await listCourseExceptions(db)).toEqual([]);
    // Un jour off qui ne suspend pas les cours reste accessible.
    await moveCalendarItem(db, courseItem(seriesId, subjectId, '2026-10-12'), {
      date: '2026-11-11',
      ...target,
    });
    expect((await getCourseException(db, seriesId, '2026-10-12'))?.newDate).toBe('2026-11-11');
  });

  it('annuler une séance efface sa note ; les séances déjà annulées ou masquées ne sont pas recomptées', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const seriesId = await createCourse(db, weekly(subjectId));
    await overrideOccurrence(db, { seriesId, date: '2026-09-14', note: 'Salle changée' });
    await cancelOccurrence(db, seriesId, '2026-09-14');
    expect(await getCourseException(db, seriesId, '2026-09-14')).toMatchObject({
      kind: 'cancelled',
      note: null,
    });
    await createOffPeriod(db, {
      name: 'Rentrée décalée',
      kind: 'day_off',
      startDate: '2026-09-07',
      endDate: '2026-09-07',
      suspendCourses: true,
    });
    const series = await listCourseSeries(db);
    const context = {
      exceptions: await listCourseExceptions(db),
      offPeriods: await listOffPeriods(db),
    };
    // 3 lundis du 7 au 21 : le 7 est déjà suspendu, le 14 déjà annulé → une seule séance touchée.
    expect(countAffectedOccurrences(series, '2026-09-07', '2026-09-21')).toBe(3);
    expect(countAffectedOccurrences(series, '2026-09-07', '2026-09-21', context)).toBe(1);
  });

  it('une séance déplacée sur une séance régulière garde une clé React distincte', () => {
    const regular = courseItem('s1', 'm1', '2026-09-16');
    const moved = courseItem('s1', 'm1', '2026-09-14');
    if (moved.kind === 'course') {
      moved.occurrence = { ...moved.occurrence, date: '2026-09-16', status: 'modified' };
    }
    expect(calendarItemKey(moved)).not.toBe(calendarItemKey(regular));
  });
});
