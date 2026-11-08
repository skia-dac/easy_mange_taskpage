import type { CourseSeries, Exam } from '@/modules/academic';
import { defaultNotificationPreferences } from '@/modules/identity';
import type { WorkItem } from '@/modules/productivity';
import { atTime, toIsoDate } from '@/shared/dates';

import {
  dailyHorizonDays,
  firstReviewDay,
  HABIT_HORIZON_DAYS,
  MAX_COURSE_REMINDERS,
  MAX_HABIT_HORIZON_DAYS,
  MAX_SCHEDULED,
  planReminders,
  type PlannedReminder,
} from './plan';

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
const isCourse = (r: PlannedReminder) =>
  r.action.kind === 'course' || r.action.kind === 'endOfCourse';
const isNet = (r: PlannedReminder) => r.action.kind === 'refresh';
const habit = (id: string, reminderTime: string | null = '21:00') => ({
  id,
  position: 0,
  name: `Habitude ${id}`,
  icon: 'star',
  colorId: 'blue',
  frequency: 'daily' as const,
  weekdays: [],
  timesPerWeek: 1,
  target: 1,
  unit: null,
  reminderTime,
  autoStudy: false,
  tracksBody: false,
});
const task = (i: number): WorkItem => ({
  id: `t${i}`,
  kind: 'task',
  title: `Tâche ${i}`,
  description: null,
  subjectId: null,
  dueDate: null,
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  // Une tâche toutes les 12 h, à partir de demain 10:00.
  reminderAt: new Date(2026, 8, 24, 10 + 12 * i, 0).toISOString(),
  repeat: 'none',
  estimatedMinutes: null,
  space: 'personal',
});

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
    space: 'personal' as const,
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

it(`ne dépasse jamais ${MAX_SCHEDULED} notifications ni ${MAX_COURSE_REMINDERS} rappels de cours, les plus proches d’abord`, () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    ...series,
    id: `s${i}`,
    weekday: (i % 7) + 1,
  }));
  const plan = planReminders({ ...empty, series: many }, prefs, now, names);
  // Quota des cours atteint, plus le filet de sécurité (des cours ne sont plus programmés).
  expect(plan.filter(isCourse)).toHaveLength(MAX_COURSE_REMINDERS);
  expect(plan.filter(isNet)).toHaveLength(1);
  expect(plan).toHaveLength(MAX_COURSE_REMINDERS + 1);
  for (let i = 1; i < plan.length; i++)
    expect(plan[i]!.fireAt.getTime()).toBeGreaterThanOrEqual(plan[i - 1]!.fireAt.getTime());

  // Six rappels de cours par jour contre un d'habitude : les cours atteignent leur quota en
  // quelques jours, l'habitude garde au moins ses 7 jours de rappels, même plus lointains, et
  // prend la place restante (une place gardée pour le filet de sécurité).
  const dense = Array.from({ length: 20 }, (_, i) => ({
    ...series,
    id: `s${i}`,
    weekday: (i % 7) + 1,
  }));
  const habits = Array.from({ length: 1 }, (_, i) => ({
    id: `h${i}`,
    position: i,
    name: `Habitude ${i}`,
    icon: 'star',
    colorId: 'blue',
    frequency: 'daily' as const,
    weekdays: [],
    timesPerWeek: 1,
    target: 1,
    unit: null,
    reminderTime: '21:00',
    autoStudy: false,
    tracksBody: false,
  }));
  const mixed = planReminders({ ...empty, series: dense, habits }, prefs, now, names);
  const courses = mixed.filter(
    (r) => r.action.kind === 'course' || r.action.kind === 'endOfCourse',
  );
  const others = mixed.filter((r) => r.action.kind === 'habit');
  expect(courses).toHaveLength(MAX_COURSE_REMINDERS);
  expect(others.length).toBeGreaterThanOrEqual(HABIT_HORIZON_DAYS);
  expect(others).toHaveLength(MAX_SCHEDULED - 1 - MAX_COURSE_REMINDERS);
  expect(mixed.filter(isNet)).toHaveLength(1);
  expect(mixed).toHaveLength(MAX_SCHEDULED);
  const lastCourse = courses[courses.length - 1]!.fireAt.getTime();
  expect(others[others.length - 1]!.fireAt.getTime()).toBeGreaterThan(lastCourse);
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
    space: 'personal' as const,
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
    // Le quota est presque libre : le bilan est planifié sur 4 semaines (au lieu d'une).
    expect(plan.filter((p) => p.action.kind === 'review')).toHaveLength(MAX_HABIT_HORIZON_DAYS);
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

describe('horizon des rappels quotidiens', () => {
  it('calculé sur le quota restant, entre 7 jours et 4 semaines', () => {
    expect(dailyHorizonDays(0, 0)).toBe(HABIT_HORIZON_DAYS);
    // 59 places libres pour 2 rappels par jour : 29 jours, plafonnés à 28.
    expect(dailyHorizonDays(0, 2)).toBe(MAX_HABIT_HORIZON_DAYS);
    // 40 cours : 19 places pour 1 habitude et le bilan : 9 jours.
    expect(dailyHorizonDays(40, 2)).toBe(9);
    // Quota presque plein : jamais moins d'une semaine (le plus proche d'abord, comme avant).
    expect(dailyHorizonDays(58, 3)).toBe(HABIT_HORIZON_DAYS);
  });

  it('une habitude seule : 4 semaines de rappels', () => {
    const plan = planReminders({ ...empty, habits: [habit('h1')] }, prefs, now, names);
    expect(plan.filter((p) => p.action.kind === 'habit')).toHaveLength(MAX_HABIT_HORIZON_DAYS);
  });
});

describe('filet de sécurité (« Ouvre MySky pour garder tes rappels à jour »)', () => {
  it('le matin du dernier jour couvert par les habitudes et le bilan', () => {
    // 45 tâches : 14 places pour 1 habitude + le bilan, donc 7 jours.
    const work = Array.from({ length: 45 }, (_, i) => task(i));
    const plan = planReminders(
      { ...empty, work, habits: [habit('h1')] },
      { ...prefs, eveningReview: true, eveningReviewTime: '20:30' },
      now,
      names,
    );
    const net = plan.filter(isNet);
    expect(net).toHaveLength(1);
    // Septième jour (aujourd'hui + 6), 09:00 : avant son bilan de 20:30 et son habitude de 21:00.
    expect(net[0]?.fireAt).toEqual(atTime('2026-09-29', '09:00'));
    expect(net[0]?.id).toBe('refresh:2026-09-29');
    expect(net[0]?.title.key).toBe('notif.refreshTitle');
    expect(net[0]?.body.key).toBe('notif.refreshBody');
    const reviews = plan.filter((p) => p.action.kind === 'review');
    expect(reviews).toHaveLength(HABIT_HORIZON_DAYS);
    expect(net[0]!.fireAt.getTime()).toBeLessThan(reviews.at(-1)!.fireAt.getTime());
    // Dans le quota : 45 tâches + 7 habitudes + 7 bilans + le filet.
    expect(plan).toHaveLength(MAX_SCHEDULED);
  });

  it('compté dans le quota, même plein', () => {
    const work = Array.from({ length: 80 }, (_, i) => task(i));
    const plan = planReminders({ ...empty, work, habits: [habit('h1')] }, prefs, now, names);
    expect(plan).toHaveLength(MAX_SCHEDULED);
    const net = plan.find(isNet);
    expect(net).toBeDefined();
    // Avant le premier rappel écarté par le quota (sinon il manquerait sans prévenir).
    const firstMissing = Array.from({ length: 80 }, (_, i) => task(i)).find(
      (w) => !plan.some((p) => p.id === `work:task:${w.id}`),
    );
    expect(net!.fireAt.getTime()).toBeLessThan(new Date(firstMissing!.reminderAt!).getTime());
  });

  it('rien de répétitif (seulement des tâches) : pas de filet, tout le quota pour les rappels', () => {
    const work = Array.from({ length: 70 }, (_, i) => task(i));
    const plan = planReminders({ ...empty, work }, prefs, now, names);
    expect(plan.some(isNet)).toBe(false);
    expect(plan).toHaveLength(MAX_SCHEDULED);
    expect(planReminders(empty, prefs, now, names)).toEqual([]);
    // Une habitude sans heure de rappel ne compte pas.
    const silent = planReminders({ ...empty, habits: [habit('h1', null)] }, prefs, now, names);
    expect(silent).toEqual([]);
  });

  it('cours seuls, sans quota atteint : à la fin de l’horizon de 45 jours', () => {
    const plan = planReminders({ ...empty, series: [series] }, prefs, now, names);
    const net = plan.find(isNet);
    expect(net?.fireAt).toEqual(atTime('2026-11-07', '09:00'));
  });

  it('jamais pendant un cours en mode focus : la veille au soir', () => {
    // Le 28e jour (aujourd'hui + 27 = mardi 20 oct.) a un cours de 08:30 à 10:00.
    const tuesday = { ...series, id: 's2', weekday: 2, startTime: '08:30', endTime: '10:00' };
    const plan = planReminders(
      { ...empty, series: [tuesday], habits: [habit('h1')] },
      { ...prefs, courses: false, endOfCourse: false, focusDuringCourses: true },
      now,
      names,
    );
    expect(plan.find(isNet)?.fireAt).toEqual(atTime('2026-10-19', '19:00'));
  });

  it('fait partie de l’empreinte : mêmes données, même filet', () => {
    const data = { ...empty, habits: [habit('h1')] };
    const a = planReminders(data, prefs, now, names).find(isNet);
    const b = planReminders(data, prefs, now, names).find(isNet);
    expect(a).toEqual(b);
  });
});

describe('premier bilan du soir : il s’explique', () => {
  it('le jour d’introduction a son propre texte, les suivants le texte habituel', () => {
    const plan = planReminders(empty, { ...prefs, eveningReview: true }, now, names, {
      reviewIntroDate: firstReviewDay(prefs, now),
    });
    const reviews = plan.filter((p) => p.action.kind === 'review');
    expect(reviews[0]?.id).toBe('review:2026-09-23');
    expect(reviews[0]?.body.key).toBe('notif.reviewBodyFirst');
    expect(reviews.slice(1).every((r) => r.body.key === 'notif.reviewBody')).toBe(true);
  });

  it('le prochain bilan : aujourd’hui, ou demain si l’heure est passée', () => {
    expect(firstReviewDay({ eveningReviewTime: '20:30' }, now)).toBe('2026-09-23');
    expect(firstReviewDay({ eveningReviewTime: '07:00' }, now)).toBe('2026-09-24');
  });
});
