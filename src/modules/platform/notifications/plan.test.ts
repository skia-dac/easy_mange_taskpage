import type { CourseSeries, Exam } from '@/modules/academic';
import { defaultNotificationPreferences } from '@/modules/identity';
import type { WorkItem } from '@/modules/productivity';

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
const prefs = defaultNotificationPreferences;
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
