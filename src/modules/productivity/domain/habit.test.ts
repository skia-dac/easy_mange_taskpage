import { createTestDb } from '@/test/memoryDb';

import {
  addHabitCount,
  createHabit,
  deleteHabit,
  listHabitLogs,
  listHabits,
  setHabitDone,
  setHabitMissed,
} from '../data/habitCommands';
import { endStudySession, startStudySession } from '../data/studyCommands';
import {
  completionRate,
  dayState,
  doneInWeek,
  isScheduledOn,
  streak,
  topReasons,
  weeklyReview,
  type Habit,
  type HabitLog,
} from './habit';

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: 'Sport',
  icon: 'activity',
  colorId: 'green',
  frequency: 'daily',
  weekdays: [],
  timesPerWeek: 1,
  target: 1,
  unit: null,
  reminderTime: null,
  autoStudy: false,
  position: 0,
  ...over,
});
const log = (date: string, over: Partial<HabitLog> = {}): HabitLog => ({
  id: date,
  habitId: 'h',
  date,
  count: 1,
  status: 'done',
  reasonCode: null,
  reason: null,
  ...over,
});
// 23 sept. 2026 = mercredi ; semaine du lundi 21.
const today = '2026-09-23';

describe('habitudes — calculs', () => {
  it('sait quels jours une habitude est prévue', () => {
    expect(isScheduledOn(habit(), '2026-09-26')).toBe(true);
    const school = habit({ frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5] });
    expect(isScheduledOn(school, '2026-09-23')).toBe(true);
    expect(isScheduledOn(school, '2026-09-26')).toBe(false);
  });

  it('donne l’état de chaque jour : fait, partiel, manqué, excusé, à faire, pas prévu', () => {
    const water = habit({ target: 8 });
    const logs = [
      log('2026-09-21', { count: 8 }),
      log('2026-09-22', { count: 3 }),
      log('2026-09-20', { status: 'excused', count: 0 }),
    ];
    expect(dayState(water, logs, '2026-09-21', today)).toBe('done');
    expect(dayState(water, logs, '2026-09-22', today)).toBe('partial');
    expect(dayState(water, logs, '2026-09-20', today)).toBe('excused');
    expect(dayState(water, logs, '2026-09-19', today)).toBe('missed');
    expect(dayState(water, logs, today, today)).toBe('pending');
    const school = habit({ frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5] });
    expect(dayState(school, [], '2026-09-19', today)).toBe('off');
  });

  it('calcule la série sans compter les jours excusés ni aujourd’hui pas encore fait', () => {
    const logs = [
      log('2026-09-18'),
      log('2026-09-19'),
      log('2026-09-20', { status: 'excused', count: 0 }),
      log('2026-09-21'),
      log('2026-09-22'),
    ];
    expect(streak(habit(), logs, today)).toBe(4);
    expect(streak(habit(), [...logs, log(today)], today)).toBe(5);
    // Un jour manqué casse la série.
    expect(streak(habit(), [log('2026-09-20'), log('2026-09-22')], today)).toBe(1);
    // Jours d'école : le week-end ne casse rien.
    const school = habit({ frequency: 'weekdays', weekdays: [1, 2, 3, 4, 5] });
    expect(streak(school, [log('2026-09-18'), log('2026-09-21'), log('2026-09-22')], today)).toBe(
      3,
    );
  });

  it('compte les semaines réussies pour « N fois par semaine »', () => {
    const sport = habit({ frequency: 'weekly', timesPerWeek: 2 });
    const logs = [
      log('2026-09-08'),
      log('2026-09-10'),
      log('2026-09-15'),
      log('2026-09-17'),
      log('2026-09-21'),
    ];
    expect(doneInWeek(sport, logs, '2026-09-21')).toBe(1);
    // Semaine en cours pas encore finie : on compte les 2 semaines précédentes réussies.
    expect(streak(sport, logs, today)).toBe(2);
    expect(dayState(sport, logs, '2026-09-22', today)).toBe('off');
  });

  it('calcule le taux de réussite en ignorant les jours excusés et aujourd’hui', () => {
    const logs = [log('2026-09-21'), log('2026-09-22', { status: 'excused', count: 0 })];
    // 21 fait, 22 excusé, 23 (aujourd'hui) pas encore fait → 1 / 1.
    expect(completionRate(habit(), logs, '2026-09-21', '2026-09-27', today)).toBe(1);
    // Sur la semaine précédente, rien de fait → 0.
    expect(completionRate(habit(), logs, '2026-09-14', '2026-09-20', today)).toBe(0);
    expect(completionRate(habit(), logs, '2026-09-28', '2026-10-04', today)).toBeNull();
  });

  it('fait le bilan de la semaine avec les raisons', () => {
    const sport = habit({ id: 'h', name: 'Sport' });
    const read = habit({ id: 'r', name: 'Lire' });
    const logs = [
      log('2026-09-21', { status: 'missed', count: 0, reasonCode: 'tired', reason: 'Nuit courte' }),
      log('2026-09-22', { status: 'missed', count: 0, reasonCode: 'tired' }),
      log('2026-09-21', { habitId: 'r' }),
      log('2026-09-22', { habitId: 'r', status: 'missed', count: 0, reasonCode: 'noTime' }),
    ];
    const review = weeklyReview([sport, read], logs, '2026-09-21', today);
    expect(review[0]).toMatchObject({ name: 'Sport', done: 0, expected: 7, respected: false });
    expect(review[0]?.misses.map((m) => [m.date, m.reasonCode, m.reason])).toEqual([
      ['2026-09-21', 'tired', 'Nuit courte'],
      ['2026-09-22', 'tired', null],
    ]);
    expect(review[1]?.done).toBe(1);
    expect(topReasons(review)).toEqual([
      { code: 'tired', count: 2 },
      { code: 'noTime', count: 1 },
    ]);
  });
});

describe('habitudes — enregistrement', () => {
  it('coche, compte, note une raison, puis supprime avec l’historique', async () => {
    const db = await createTestDb();
    const water = await createHabit(db, {
      name: 'Boire de l’eau',
      frequency: 'daily',
      target: 8,
      unit: 'verres',
    });
    const school = await createHabit(db, {
      name: 'Aller en cours',
      frequency: 'weekdays',
      weekdays: [5, 1, 3],
    });
    expect((await listHabits(db)).map((h) => [h.name, h.position])).toEqual([
      ['Boire de l’eau', 0],
      ['Aller en cours', 1],
    ]);
    expect((await listHabits(db))[1]?.weekdays).toEqual([1, 3, 5]);

    await addHabitCount(db, water, today, 1);
    await addHabitCount(db, water, today, 1);
    let logs = await listHabitLogs(db, today, today);
    expect(logs.map((l) => [l.count, l.status])).toEqual([[2, 'done']]);
    await addHabitCount(db, water, today, -5);
    expect(await listHabitLogs(db, today, today)).toEqual([]);

    await setHabitDone(db, school, today, true);
    await setHabitMissed(db, school, '2026-09-21', 'missed', 'sick', '  Grippe  ');
    logs = await listHabitLogs(db, '2026-09-21', today, school);
    expect(logs.map((l) => [l.date, l.status, l.reasonCode, l.reason])).toEqual([
      ['2026-09-21', 'missed', 'sick', 'Grippe'],
      [today, 'done', null, null],
    ]);
    // Cocher après « pas fait » remplace la note.
    await setHabitDone(db, school, '2026-09-21', true);
    expect((await listHabitLogs(db, '2026-09-21', '2026-09-21'))[0]).toMatchObject({
      status: 'done',
      reasonCode: null,
    });

    await deleteHabit(db, school);
    expect((await listHabits(db)).map((h) => h.name)).toEqual(['Boire de l’eau']);
    expect(await listHabitLogs(db, '2026-09-01', '2026-09-30', school)).toEqual([]);
    db.close();
  });

  it('refuse une habitude « certains jours » sans jour choisi', async () => {
    const db = await createTestDb();
    await expect(
      createHabit(db, { name: 'X', frequency: 'weekdays', weekdays: [] }),
    ).rejects.toThrow('weekdays');
    db.close();
  });

  it('une session de révision terminée coche l’habitude « Réviser »', async () => {
    const db = await createTestDb();
    const study = await createHabit(db, { name: 'Réviser', autoStudy: true });
    const other = await createHabit(db, { name: 'Sport' });
    const short = await startStudySession(db, {
      subjectId: null,
      startedAt: '2026-09-23T08:00:00.000Z',
      plannedMinutes: 25,
    });
    await endStudySession(db, short, '2026-09-23T08:02:00.000Z');
    expect(await listHabitLogs(db, '2026-09-23', '2026-09-23')).toEqual([]);
    const real = await startStudySession(db, {
      subjectId: null,
      startedAt: '2026-09-23T09:00:00.000Z',
      plannedMinutes: 25,
    });
    await endStudySession(db, real, '2026-09-23T09:25:00.000Z');
    const logs = await listHabitLogs(db, '2026-09-23', '2026-09-23');
    expect(logs.map((l) => [l.habitId, l.status])).toEqual([[study, 'done']]);
    expect(logs.some((l) => l.habitId === other)).toBe(false);
    db.close();
  });
});
