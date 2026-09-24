import type { StudySession } from '@/modules/productivity';

import { weekStats } from './stats';
import type { TodayData } from './today';

const now = new Date(2026, 8, 23, 10, 0); // mercredi 23 sept. 2026
const work = (
  id: string,
  status: 'todo' | 'done',
  dueDate: string,
  completedAt: string | null,
) => ({
  id,
  kind: 'task' as const,
  title: id,
  description: null,
  subjectId: null,
  dueDate,
  dueTime: null,
  priority: 'normal' as const,
  status,
  completedAt,
  reminderAt: null,
  repeat: 'none' as const,
});
const session = (day: string, minutes: number): StudySession => ({
  id: day,
  subjectId: null,
  startedAt: new Date(`${day}T08:00:00`).toISOString(),
  endedAt: new Date(new Date(`${day}T08:00:00`).getTime() + minutes * 60_000).toISOString(),
  plannedMinutes: minutes,
  kind: 'focus',
});

const data: TodayData = {
  series: [
    {
      id: 'c1',
      subjectId: 'mkt',
      timetableId: null,
      title: null,
      teacher: null,
      room: null,
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
  exceptions: [
    {
      id: 'x',
      seriesId: 'c1',
      date: '2026-09-30',
      kind: 'cancelled',
      newStartTime: null,
      newEndTime: null,
      newRoom: null,
      newTeacher: null,
      newTitle: null,
      note: null,
    },
  ],
  exams: [],
  events: [],
  work: [
    work('a', 'done', '2026-09-22', new Date(2026, 8, 22, 12).toISOString()),
    work('b', 'done', '2026-09-10', new Date(2026, 8, 10, 12).toISOString()),
    work('c', 'todo', '2026-09-25', null),
    work('d', 'todo', '2026-10-25', null),
  ],
};

describe('statistiques de la semaine', () => {
  it('compte les heures de cours, les tâches et la révision de la semaine', () => {
    const s = weekStats(
      data,
      [session('2026-09-23', 30), session('2026-09-15', 60)],
      '2026-09-21',
      now,
    );
    expect(s.courseMinutes).toBe(120);
    expect(s.tasksDone).toBe(1);
    expect(s.tasksOpen).toBe(1);
    expect(s.studyMinutes).toBe(30);
    expect(s.studyByDay.map((d) => d.minutes)).toEqual([0, 0, 30, 0, 0, 0, 0]);
  });

  it('ignore les séances annulées', () => {
    const s = weekStats(data, [], '2026-09-28', now);
    expect(s.courseMinutes).toBe(0);
  });

  it('calcule la série de jours actifs jusqu’à aujourd’hui', () => {
    // Tâche terminée hier (22), révision aujourd'hui (23) et avant-hier (21) : 3 jours.
    const s = weekStats(
      data,
      [session('2026-09-23', 10), session('2026-09-21', 10)],
      '2026-09-21',
      now,
    );
    expect(s.streakDays).toBe(3);
    // Rien aujourd'hui ni hier : la série est à 0.
    const none = weekStats({ ...data, work: [] }, [session('2026-09-19', 10)], '2026-09-21', now);
    expect(none.streakDays).toBe(0);
  });
});
