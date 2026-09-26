import {
  createCourse,
  createExam,
  createSubject,
  deleteExam,
  listCourseExceptions,
  listCourseSeries,
  listTimetables,
  occurrencesInRange,
  overrideOccurrence,
} from '@/modules/academic';
import {
  addSubtask,
  createRevisionBlock,
  createWorkItem,
  deleteWorkItem,
  endStudySession,
  getMoodLog,
  getRevisionBlock,
  linkStudySession,
  listMoodLogs,
  listRevisionBlocks,
  listStudySessions,
  listSubtasks,
  listWorkItems,
  moodByHabit,
  moveRevisionBlock,
  moveSubtask,
  postponeTargets,
  rescheduleWorkItem,
  saveMoodLog,
  setSubtaskDone,
  setWorkStatus,
  startStudySession,
  subtaskCounts,
  summarizeMood,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

import { saveRevisionPlan } from './revisionPlan';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const task = {
  title: 'Exposé',
  dueDate: '2026-09-24',
  priority: 'normal' as const,
  status: 'todo' as const,
  reminderAt: '2026-09-24T07:00:00.000Z',
  estimatedMinutes: 45,
};

describe('sous-tâches et durée estimée', () => {
  it('garde la durée, compte l’avancement et réordonne', async () => {
    const id = await createWorkItem(db, 'task', task);
    const a = await addSubtask(db, 'task', id, 'Plan');
    const b = await addSubtask(db, 'task', id, 'Diapos');
    await setSubtaskDone(db, a, true);
    await moveSubtask(db, b, -1);
    expect((await listSubtasks(db, 'task', id)).map((s) => [s.title, s.done])).toEqual([
      ['Diapos', false],
      ['Plan', true],
    ]);
    expect((await subtaskCounts(db)).get(`task:${id}`)).toEqual({ done: 1, total: 2 });
    expect((await listWorkItems(db, 'task'))[0]?.estimatedMinutes).toBe(45);
  });

  it('refuse une durée hors limites', async () => {
    await expect(
      createWorkItem(db, 'task', { ...task, estimatedMinutes: 2 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('une tâche répétée reprend la checklist décochée ; la supprimer supprime ses sous-tâches', async () => {
    const id = await createWorkItem(db, 'task', { ...task, repeat: 'weekly' });
    const s = await addSubtask(db, 'task', id, 'Relire');
    await setSubtaskDone(db, s, true);
    await setWorkStatus(db, 'task', id, 'done');
    const next = (await listWorkItems(db, 'task')).find((w) => w.id !== id);
    expect(next?.dueDate).toBe('2026-10-01');
    expect((await listSubtasks(db, 'task', next?.id ?? '')).map((x) => x.done)).toEqual([false]);
    await deleteWorkItem(db, 'task', id);
    expect(await listSubtasks(db, 'task', id)).toEqual([]);
  });
});

describe('reporter une tâche', () => {
  it('propose demain, dans 2 jours et lundi prochain', () => {
    expect(postponeTargets('2026-09-24')).toEqual({
      tomorrow: '2026-09-25',
      inTwoDays: '2026-09-26',
      nextMonday: '2026-09-28',
    });
    // Un lundi : lundi prochain = dans 7 jours.
    expect(postponeTargets('2026-09-28').nextMonday).toBe('2026-10-05');
  });

  it('décale l’échéance et le rappel du même nombre de jours', async () => {
    const id = await createWorkItem(db, 'task', task);
    await rescheduleWorkItem(db, 'task', id, '2026-09-26');
    const [w] = await listWorkItems(db, 'task');
    expect(w?.dueDate).toBe('2026-09-26');
    expect(w?.reminderAt).toBe('2026-09-26T07:00:00.000Z');
    await rescheduleWorkItem(db, 'task', id, '2026-09-26', '14:30');
    expect((await listWorkItems(db, 'task'))[0]?.dueTime).toBe('14:30');
  });
});

describe('séances de révision', () => {
  it('se déplacent et passent à « faite » après une session Pomodoro rattachée', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const examId = await createExam(db, { subjectId, title: 'Partiel', date: '2026-10-10' });
    const id = await createRevisionBlock(db, {
      subjectId,
      examId,
      date: '2026-10-01',
      startTime: '18:00',
      endTime: '19:00',
    });
    await moveRevisionBlock(db, id, { date: '2026-10-02', startTime: '17:00', endTime: '18:00' });
    const session = await startStudySession(db, {
      subjectId,
      startedAt: '2026-10-02T17:00:00.000Z',
      plannedMinutes: 25,
    });
    await linkStudySession(db, id, session);
    await endStudySession(db, session, '2026-10-02T17:25:00.000Z');
    expect(await getRevisionBlock(db, id)).toMatchObject({
      date: '2026-10-02',
      startTime: '17:00',
      status: 'done',
    });
    await deleteExam(db, examId);
    expect((await getRevisionBlock(db, id))?.examId).toBeNull();
  });
});

describe('déplacer une séance de cours', () => {
  it('garde la clé du jour prévu et apparaît au nouveau jour', async () => {
    const subjectId = await createSubject(db, { name: 'Droit', colorId: 'violet' });
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
    await overrideOccurrence(db, {
      seriesId,
      date: '2026-09-28',
      newDate: '2026-09-30',
      newStartTime: '10:00',
      newEndTime: '12:00',
    });
    // Modifier ensuite la salle sans parler du jour ne ramène pas la séance.
    await overrideOccurrence(db, {
      seriesId,
      date: '2026-09-28',
      newStartTime: '10:00',
      newEndTime: '12:00',
      newRoom: 'A1',
    });
    const occ = occurrencesInRange(await listCourseSeries(db), '2026-09-28', '2026-10-04', {
      exceptions: await listCourseExceptions(db),
    });
    expect(occ.map((o) => [o.date, o.originalDate, o.startTime, o.room])).toEqual([
      ['2026-09-30', '2026-09-28', '10:00', 'A1'],
    ]);
  });
});

describe('journal d’humeur', () => {
  it('une entrée par jour, moyennes et lien avec une habitude', async () => {
    await saveMoodLog(db, { date: '2026-09-21', mood: 2, energy: 2 });
    await saveMoodLog(db, { date: '2026-09-21', mood: 3, energy: 2, note: 'Fatigué' });
    await saveMoodLog(db, { date: '2026-09-22', mood: 4, energy: 5 });
    await saveMoodLog(db, { date: '2026-09-23', mood: 5, energy: 4 });
    await saveMoodLog(db, { date: '2026-09-24', mood: 2, energy: 1 });
    expect(await getMoodLog(db, '2026-09-21')).toMatchObject({ mood: 3, note: 'Fatigué' });
    const logs = await listMoodLogs(db, '2026-09-21', '2026-09-27');
    expect(summarizeMood(logs)).toEqual({ days: 4, mood: 3.5, energy: 3 });
    expect(moodByHabit(logs, new Set(['2026-09-22', '2026-09-23']))).toEqual({
      energyDone: 4.5,
      energyMissed: 1.5,
      moodDone: 4.5,
      moodMissed: 2.5,
    });
    await expect(
      saveMoodLog(db, { date: '2026-09-25', mood: 6, energy: 3 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('enregistrer un plan de révision', () => {
  it('crée l’emploi du temps « Révisions », puis l’agrandit et remplace les séances prévues', async () => {
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const examId = await createExam(db, { subjectId, date: '2026-10-10' });
    const block = (date: string) => ({ date, startTime: '18:00', endTime: '19:00' });
    await saveRevisionPlan(db, {
      examId,
      subjectId,
      timetableName: 'Révisions',
      blocks: [block('2026-10-05'), block('2026-10-08')],
      replacePlanned: false,
    });
    await saveRevisionPlan(db, {
      examId,
      subjectId,
      timetableName: 'Révisions',
      blocks: [block('2026-10-03'), block('2026-10-09')],
      replacePlanned: true,
    });
    const timetables = await listTimetables(db);
    expect(timetables.map((t) => [t.kind, t.validFrom, t.validUntil])).toEqual([
      ['revision', '2026-10-03', '2026-10-09'],
    ]);
    const blocks = await listRevisionBlocks(db, { examId });
    expect(blocks.map((b) => [b.date, b.timetableId])).toEqual([
      ['2026-10-03', timetables[0]?.id],
      ['2026-10-09', timetables[0]?.id],
    ]);
  });
});

describe('finitions du lot F', () => {
  it('humeur : deux entrées le même jour (deux appareils), la plus récente gagne', async () => {
    const insert = (id: string, mood: number, updatedAt: string) =>
      db.runAsync(
        `INSERT INTO mood_logs (id, created_at, updated_at, version, sync_status, date, mood, energy)
         VALUES (?, ?, ?, 1, 'synced', '2026-09-22', ?, 3)`,
        [id, updatedAt, updatedAt, mood],
      );
    // La plus récente est insérée en premier : l'ordre d'insertion ne décide plus.
    await insert('b', 5, '2026-09-22T20:00:00.000Z');
    await insert('a', 1, '2026-09-22T08:00:00.000Z');
    const logs = await listMoodLogs(db, '2026-09-21', '2026-09-27');
    expect(logs.map((l) => l.mood)).toEqual([5]);
    expect((await getMoodLog(db, '2026-09-22'))?.mood).toBe(5);
  });

  it('sessions : bornées par jour local (00:30 et 23:30 comptent), valeurs inconnues repliées', async () => {
    const at = (d: number, h: number, m: number) => new Date(2026, 8, d, h, m).toISOString();
    await startStudySession(db, { subjectId: null, startedAt: at(21, 0, 30), plannedMinutes: 25 });
    await startStudySession(db, { subjectId: null, startedAt: at(27, 23, 30), plannedMinutes: 25 });
    await startStudySession(db, { subjectId: null, startedAt: at(20, 23, 59), plannedMinutes: 25 });
    await startStudySession(db, { subjectId: null, startedAt: at(28, 0, 1), plannedMinutes: 25 });
    const list = await listStudySessions(db, '2026-09-21', '2026-09-27');
    expect(list).toHaveLength(2);
    await db.runAsync("UPDATE study_sessions SET kind = 'nap'", []);
    const again = await listStudySessions(db, '2026-09-21', '2026-09-27');
    expect(again.map((s) => s.kind)).toEqual(['focus', 'focus']);
  });
});
