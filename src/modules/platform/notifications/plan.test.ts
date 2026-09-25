import type { CourseSeries, Exam } from '@/modules/academic';
import { defaultNotificationPreferences } from '@/modules/identity';
import type { WorkItem } from '@/modules/productivity';
import { atTime, toIsoDate } from '@/shared/dates';

import { MAX_SCHEDULED, planReminders } from './plan';

const series: CourseSeries = {
  id: 's1',
  subjectId: 'mkt',
  timetableId: null,
  title: null,
  teacher: null,
  room: 'B12',
  courseType: 'lecture',
  recurrence: 'weekly',
  weekday: 3,
  validFrom: '2026-09-01',
  validUntil: '2026-12-20',
  startTime: '09:00',
  endTime: '11:00',
  description: null,
  reminderMinutes: null,
};
const names = { subjectName: () => 'Marketing' };
const now = new Date(2026, 8, 23, 8, 0); // mercredi 23 sept. 08:00
// Le bilan du soir est testé à part : ici, seulement les rappels liés aux données.
const prefs = { ...defaultNotificationPreferences, eveningReview: false };
const empty = { series: [], exams: [], work: [], events: [] };

describe('rappels de cours (§72) et fin de cours (§76)', () => {
  it('programme le rappel 15 min avant et la notification de fin', () => {
    const plan = planReminders({ ...empty, series: [series] }, prefs, now, names);
    const first = plan.filter((p) => p.action.kind !== 'exam').slice(0, 2);
    expect(first.map((p) => [p.id, p.fireAt.getHours(), p.fireAt.getMinutes()])).toEqual([
      ['course:s1:2026-09-23', 8, 45],
      ['end:s1:2026-09-23', 11, 0],
    ]);
    expect(first[1]?.category).toBe('endOfCourse');
  });

  it('respecte le réglage du cours (0 = aucun) et le réglage général', () => {
    const none = planReminders(
      { ...empty, series: [{ ...series, reminderMinutes: 0 }] },
      prefs,
      now,
      names,
    );
    expect(none.some((p) => p.action.kind === 'course')).toBe(false);
    const early = new Date(2026, 8, 23, 7, 0);
    const hour = planReminders(
      { ...empty, series: [series] },
      { ...prefs, courseReminderMinutes: 60 },
      early,
      names,
    );
    expect(hour[0]?.id).toBe('course:s1:2026-09-23');
    expect([hour[0]?.fireAt.getHours(), hour[0]?.fireAt.getMinutes()]).toEqual([8, 0]);
  });

  it('ne programme rien pour une séance annulée ni pour un cours déjà commencé', () => {
    const plan = planReminders(
      {
        ...empty,
        series: [series],
        exceptions: [
          {
            id: 'e',
            seriesId: 's1',
            date: '2026-09-23',
            kind: 'cancelled',
            newDate: null,
            newStartTime: null,
            newEndTime: null,
            newRoom: null,
            newTeacher: null,
            newTitle: null,
            note: null,
          },
        ],
      },
      prefs,
      now,
      names,
    );
    expect(plan.find((p) => p.id.endsWith('2026-09-23'))).toBeUndefined();
    const late = planReminders(
      { ...empty, series: [series] },
      prefs,
      new Date(2026, 8, 23, 9, 30),
      names,
    );
    expect(late.find((p) => p.id === 'course:s1:2026-09-23')).toBeUndefined();
    expect(late.find((p) => p.id === 'end:s1:2026-09-23')).toBeDefined();
  });

  it('les réglages désactivés coupent les rappels (§80)', () => {
    const plan = planReminders(
      { ...empty, series: [series] },
      { ...prefs, courses: false, endOfCourse: false },
      now,
      names,
    );
    expect(plan).toEqual([]);
  });
});

describe('devoirs, tâches, examens', () => {
  const work: WorkItem = {
    id: 'w1',
    kind: 'assignment',
    title: 'Étude de cas',
    description: null,
    subjectId: 'mkt',
    dueDate: '2026-09-29',
    dueTime: null,
    priority: 'normal',
    status: 'todo',
    completedAt: null,
    reminderAt: new Date(2026, 8, 28, 18, 0).toISOString(),
    repeat: 'none',
    estimatedMinutes: null,
  };
  const exam: Exam = {
    id: 'x1',
    subjectId: 'mkt',
    title: null,
    date: '2026-10-12',
    time: '09:00',
    durationMinutes: null,
    room: null,
    description: null,
    reminderDays: [7, 1, 1],
    reminderTime: '20:00',
    grade: null,
    gradeMax: 20,
    coefficient: 1,
    timetableId: null,
  };

  it('un devoir avec rappel est programmé, pas un devoir terminé', () => {
    expect(planReminders({ ...empty, work: [work] }, prefs, now, names).map((p) => p.id)).toEqual([
      'work:assignment:w1',
    ]);
    expect(
      planReminders({ ...empty, work: [{ ...work, status: 'done' }] }, prefs, now, names),
    ).toEqual([]);
  });

  it('un examen : un rappel par nombre de jours (sans doublon), à l’heure choisie', () => {
    const plan = planReminders({ ...empty, exams: [exam] }, prefs, now, names);
    expect(plan.map((p) => [p.id, p.fireAt.getDate(), p.fireAt.getHours()])).toEqual([
      ['exam:x1:7', 5, 20],
      ['exam:x1:1', 11, 20],
    ]);
  });
});

it(`ne dépasse jamais ${MAX_SCHEDULED} notifications, les plus proches d’abord`, () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    ...series,
    id: `s${i}`,
    weekday: (i % 7) + 1,
  }));
  const plan = planReminders({ ...empty, series: many }, prefs, now, names);
  expect(plan).toHaveLength(MAX_SCHEDULED);
  for (let i = 1; i < plan.length; i++)
    expect(plan[i]!.fireAt.getTime()).toBeGreaterThanOrEqual(plan[i - 1]!.fireAt.getTime());
});

it('un événement avec rappel est programmé, et le réglage « événements » peut le couper', () => {
  const event = {
    id: 'ev1',
    title: 'Réunion asso',
    date: '2026-09-25',
    startTime: '18:00',
    endTime: null,
    description: null,
    reminderAt: new Date(2026, 8, 25, 17, 30).toISOString(),
    repeat: 'none',
    estimatedMinutes: null,
  };
  expect(planReminders({ ...empty, events: [event] }, prefs, now, names).map((p) => p.id)).toEqual([
    'event:ev1',
  ]);
  expect(
    planReminders({ ...empty, events: [event] }, { ...prefs, events: false }, now, names),
  ).toEqual([]);
});

describe('révisions et bilan du soir', () => {
  it('un rappel 10 min avant une séance prévue ; le bilan du soir chaque jour à l’heure choisie', () => {
    const block = {
      id: 'r1',
      subjectId: 'mkt',
      examId: null,
      timetableId: null,
      date: toIsoDate(now),
      startTime: '23:00',
      endTime: '23:45',
      title: null,
      status: 'planned' as const,
      studySessionId: null,
    };
    const plan = planReminders(
      { ...empty, revisionBlocks: [block, { ...block, id: 'r2', status: 'done' as const }] },
      { ...prefs, eveningReview: true, eveningReviewTime: '23:30' },
      now,
      names,
    );
    const revision = plan.find((p) => p.id === 'revision:r1');
    expect(revision?.fireAt).toEqual(atTime(block.date, '22:50'));
    expect(plan.some((p) => p.id === 'revision:r2')).toBe(false);
    expect(plan.filter((p) => p.action.kind === 'review')).toHaveLength(7);
    expect(
      planReminders(
        { ...empty, revisionBlocks: [block] },
        { ...prefs, revisions: false },
        now,
        names,
      ),
    ).toEqual([]);
  });
});

describe('argent : charges fixes et tontines', () => {
  const tontine = {
    id: 't1',
    kind: 'tontine' as const,
    name: 'Tontine du quartier',
    categoryId: 'tontine',
    amountMinor: 5000,
    currency: 'XAF',
    frequency: 'weekly' as const,
    dayOfMonth: 1,
    weekday: 6,
    time: '15:00',
    reminders: [1440, 180],
    startDate: '2026-09-01',
    endDate: null,
    active: true,
    payoutDate: '2026-09-26',
    payoutMinor: 60000,
    payoutAuto: true,
    payoutRecorded: false,
    note: null,
  };

  it('rappels la veille et 3 h avant, sauf échéance déjà payée ; rappel du tour', () => {
    const plan = planReminders(
      {
        ...empty,
        money: {
          recurring: [tontine],
          payments: [
            {
              id: 'p',
              kind: 'expense',
              amountMinor: 5000,
              currency: 'XAF',
              categoryId: 'tontine',
              date: '2026-10-02',
              note: null,
              recurringId: 't1',
              occurrenceDate: '2026-10-03',
              goalId: null,
              loanId: null,
            },
          ],
        },
      },
      prefs,
      now,
      names,
    );
    const money = plan.filter((p) => p.action.kind === 'money').map((p) => p.id);
    expect(money.slice(0, 3)).toEqual([
      'money:t1:2026-09-26:1440',
      'money:t1:2026-09-26:180',
      'payout:t1:2026-09-26',
    ]);
    expect(money.some((id) => id.includes('2026-10-03'))).toBe(false);
    expect(plan.find((p) => p.id === 'money:t1:2026-09-26:180')?.fireAt).toEqual(
      atTime('2026-09-26', '12:00'),
    );
    expect(
      planReminders(
        { ...empty, money: { recurring: [tontine], payments: [] } },
        { ...prefs, money: false },
        now,
        names,
      ),
    ).toEqual([]);
  });
});
