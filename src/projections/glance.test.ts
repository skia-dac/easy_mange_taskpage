import type { Occurrence } from '@/modules/academic';
import { slotOccurrences, type RevisionBlock, type Slot } from '@/modules/productivity';

import { coursesToday, doneThisWeek, meetingsToday, revisionWeek, workWeek } from './glance';
import type { TodayData, TodayView } from './today';

const nights: Slot = {
  id: 'n',
  title: 'Garde',
  weekdays: [1],
  startTime: '22:00',
  endTime: '06:00',
  location: null,
  note: null,
  rotation: 'every',
  validFrom: '2026-09-01',
  validUntil: null,
  colorId: 'blue',
  space: 'work',
};

const data = (events: TodayData['events']): TodayData => ({
  series: [],
  exams: [],
  work: [],
  events,
});

describe('heures Pro de la semaine', () => {
  it('un créneau de nuit compte sa durée entière, une seule fois (#11a)', () => {
    // Lundi 21 : 22:00 → mardi 06:00 = 480 min, réparties sur deux événements.
    const events = slotOccurrences([nights], '2026-09-21', '2026-09-27', '2026-09-21', 1);
    expect(events).toHaveLength(2);
    expect(workWeek(data(events), '2026-09-21', 10)).toEqual({
      plannedMinutes: 480,
      targetMinutes: 600,
      toPlanMinutes: 120,
    });
  });

  it('rendez-vous Pro : durée, ou 1 h sans heure de fin', () => {
    const events: TodayData['events'] = [
      {
        id: 'e1',
        title: 'Réunion',
        date: '2026-09-22',
        startTime: '09:00',
        endTime: '10:30',
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'e2',
        title: 'Appel',
        date: '2026-09-23',
        startTime: '14:00',
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'e3',
        title: 'Ciné',
        date: '2026-09-23',
        startTime: '20:00',
        endTime: '22:00',
        description: null,
        reminderAt: null,
        space: 'personal',
      },
    ];
    expect(workWeek(data(events), '2026-09-21', 2).plannedMinutes).toBe(150);
  });
});

describe('tuiles Pro et Études', () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 22, h, m).toISOString();
  const workItem = (over: Partial<TodayData['work'][number]>): TodayData['work'][number] => ({
    id: 'w',
    kind: 'task',
    title: 'Tâche',
    description: null,
    subjectId: null,
    dueDate: '2026-09-22',
    dueTime: null,
    priority: 'normal',
    status: 'todo',
    completedAt: null,
    reminderAt: null,
    repeat: 'none',
    estimatedMinutes: null,
    space: 'work',
    ...over,
  });

  it('workWeek : ajoute les durées estimées des tâches Pro de la semaine', () => {
    const work = [
      workItem({ id: 'a', estimatedMinutes: 90 }),
      workItem({ id: 'b', estimatedMinutes: 30, dueDate: '2026-09-28' }), // semaine suivante
      workItem({ id: 'c', estimatedMinutes: 45, space: 'personal' }),
      workItem({ id: 'd', estimatedMinutes: 20, kind: 'assignment', subjectId: 's' }), // Études
    ];
    expect(workWeek({ ...data([]), work }, '2026-09-21', 1)).toEqual({
      plannedMinutes: 90,
      targetMinutes: 60,
      toPlanMinutes: 0,
    });
  });

  it('meetingsToday : rendez-vous Pro avec une heure, 1 h sans heure de fin', () => {
    const events: TodayView['events'] = [
      {
        id: 'm1',
        title: 'Point',
        date: '2026-09-22',
        startTime: '09:00',
        endTime: '09:45',
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'm2',
        title: 'Appel',
        date: '2026-09-22',
        startTime: '11:00',
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'm3',
        title: 'Journée',
        date: '2026-09-22',
        startTime: null,
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'p1',
        title: 'Dentiste',
        date: '2026-09-22',
        startTime: '15:00',
        endTime: '16:00',
        description: null,
        reminderAt: null,
        space: 'personal',
      },
    ];
    expect(meetingsToday({ events })).toEqual({ count: 2, minutes: 105 });
    expect(meetingsToday({ events: [] })).toEqual({ count: 0, minutes: 0 });
  });

  it('doneThisWeek : tâches Pro terminées dans la semaine seulement', () => {
    const work = [
      workItem({ id: 'a', status: 'done', completedAt: at(10) }),
      workItem({ id: 'b', status: 'done', completedAt: new Date(2026, 8, 20, 10).toISOString() }),
      workItem({ id: 'c', status: 'done', completedAt: null }),
      workItem({ id: 'd', status: 'todo' }),
      workItem({ id: 'e', status: 'done', completedAt: at(11), space: 'personal' }),
      workItem({ id: 'f', status: 'done', completedAt: at(12), subjectId: 's' }),
    ];
    expect(doneThisWeek({ ...data([]), work }, '2026-09-21')).toBe(1);
  });

  it('coursesToday : nombre, minutes et fin du dernier cours, sans les séances annulées', () => {
    const course = (over: Partial<Occurrence>): Occurrence => ({
      seriesId: 's',
      subjectId: 'm',
      date: '2026-09-22',
      originalDate: '2026-09-22',
      startTime: '09:00',
      endTime: '11:00',
      title: null,
      teacher: null,
      room: null,
      courseType: 'lecture',
      recurrence: 'weekly',
      status: 'normal',
      exceptionId: null,
      note: null,
      ...over,
    });
    const courses = [
      course({}),
      course({ startTime: '14:00', endTime: '15:30' }),
      course({ startTime: '16:00', endTime: '18:00', status: 'cancelled' }),
    ];
    expect(coursesToday({ courses })).toEqual({ count: 2, minutes: 210, endsAt: '15:30' });
    expect(coursesToday({ courses: [] })).toEqual({ count: 0, minutes: 0, endsAt: null });
  });

  it('revisionWeek : minutes faites et prévues de la semaine, séances sautées ignorées', () => {
    const block = (over: Partial<RevisionBlock>): RevisionBlock => ({
      id: 'b',
      subjectId: null,
      examId: null,
      timetableId: null,
      date: '2026-09-22',
      startTime: '18:00',
      endTime: '19:00',
      title: null,
      status: 'planned',
      studySessionId: null,
      ...over,
    });
    const revisionBlocks = [
      block({ id: '1', status: 'done' }),
      block({ id: '2', startTime: '19:00', endTime: '19:30' }),
      block({ id: '3', status: 'skipped' }),
      block({ id: '4', date: '2026-09-29', status: 'done' }),
    ];
    expect(revisionWeek({ ...data([]), revisionBlocks }, '2026-09-21')).toEqual({
      doneMinutes: 60,
      plannedMinutes: 90,
    });
  });
});
