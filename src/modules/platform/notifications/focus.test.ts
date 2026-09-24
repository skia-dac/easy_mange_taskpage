import { defaultNotificationPreferences } from '@/modules/identity';
import type { TodayData } from '@/projections';

import { planReminders } from './plan';

const now = new Date(2026, 8, 23, 8, 0); // mercredi 23 sept. 2026, 08:00
const data: TodayData = {
  series: [
    {
      id: 'c1',
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
    },
  ],
  exams: [],
  events: [],
  work: [
    {
      id: 'w1',
      kind: 'task',
      title: 'Pendant le cours',
      description: null,
      subjectId: null,
      dueDate: '2026-09-23',
      dueTime: null,
      priority: 'normal',
      status: 'todo',
      completedAt: null,
      reminderAt: new Date(2026, 8, 23, 10, 0).toISOString(),
      repeat: 'none',
    },
    {
      id: 'w2',
      kind: 'task',
      title: 'Pendant la révision',
      description: null,
      subjectId: null,
      dueDate: '2026-09-23',
      dueTime: null,
      priority: 'normal',
      status: 'todo',
      completedAt: null,
      reminderAt: new Date(2026, 8, 23, 8, 10).toISOString(),
      repeat: 'none',
    },
  ],
  studySession: {
    id: 'st1',
    subjectId: null,
    startedAt: new Date(2026, 8, 23, 7, 55).toISOString(),
    endedAt: null,
    plannedMinutes: 25,
    kind: 'focus',
  },
};
const names = { subjectName: () => 'Marketing' };

describe('mode focus', () => {
  it('sans focus, tous les rappels sont gardés, plus la fin de session', () => {
    const plan = planReminders(
      data,
      { ...defaultNotificationPreferences, focusDuringCourses: false, focusDuringStudy: false },
      now,
      names,
    );
    const ids = plan.map((r) => r.id);
    expect(ids).toContain('work:task:w1');
    expect(ids).toContain('work:task:w2');
    expect(ids).toContain('study:st1');
    expect(plan.find((r) => r.id === 'study:st1')?.fireAt).toEqual(new Date(2026, 8, 23, 8, 20));
  });

  it('pendant un cours : le rappel est retiré, la fin de cours reste', () => {
    const plan = planReminders(
      data,
      { ...defaultNotificationPreferences, focusDuringCourses: true, focusDuringStudy: false },
      now,
      names,
    );
    const ids = plan.map((r) => r.id);
    expect(ids).not.toContain('work:task:w1');
    expect(ids).toContain('work:task:w2');
    expect(ids).toContain('end:c1:2026-09-23');
  });

  it('pendant une session de révision : le rappel est retiré, la fin de session reste', () => {
    const plan = planReminders(
      data,
      { ...defaultNotificationPreferences, focusDuringCourses: false, focusDuringStudy: true },
      now,
      names,
    );
    const ids = plan.map((r) => r.id);
    expect(ids).not.toContain('work:task:w2');
    expect(ids).toContain('work:task:w1');
    expect(ids).toContain('study:st1');
  });
});
