import { darkColors, lightColors } from '@/shared/theme';

import type { TodayData } from './today';
import { buildWidgetData, buildWidgetTimeline } from './widget';

const now = new Date(2026, 8, 23, 8, 30); // mercredi 23 sept. 2026, 08:30
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
    {
      id: 'c2',
      subjectId: 'fin',
      timetableId: null,
      title: 'TD Finance',
      teacher: null,
      room: null,
      courseType: 'tutorial',
      recurrence: 'weekly',
      weekday: 3,
      validFrom: '2026-09-01',
      validUntil: '2026-12-20',
      startTime: '14:00',
      endTime: '16:00',
      description: null,
      reminderMinutes: null,
    },
  ],
  exams: [
    {
      id: 'e1',
      subjectId: 'mkt',
      title: null,
      date: '2026-09-25',
      time: '09:00',
      durationMinutes: null,
      room: null,
      description: null,
      reminderDays: [],
      reminderTime: '09:00',
      grade: null,
      gradeMax: 20,
      coefficient: 1,
      timetableId: null,
    },
  ],
  events: [],
  work: [
    {
      id: 'w1',
      kind: 'assignment',
      title: 'Étude de cas',
      description: null,
      subjectId: 'mkt',
      dueDate: '2026-09-22',
      dueTime: null,
      priority: 'normal',
      status: 'todo',
      completedAt: null,
      reminderAt: null,
      repeat: 'none',
      estimatedMinutes: null,
    },
    {
      id: 'w2',
      kind: 'task',
      title: 'Plus tard',
      description: null,
      subjectId: null,
      dueDate: '2026-10-22',
      dueTime: null,
      priority: 'normal',
      status: 'todo',
      completedAt: null,
      reminderAt: null,
      repeat: 'none',
      estimatedMinutes: null,
    },
  ],
};
const subjects = new Map([
  ['mkt', { id: 'mkt', name: 'Marketing', colorId: 'blue' }],
  ['fin', { id: 'fin', name: 'Finance', colorId: 'teal' }],
]) as never;
const texts = {
  t: (key: string, params?: Record<string, string | number>) =>
    `${key}${params ? JSON.stringify(params) : ''}`,
  formatDate: () => 'Mercredi 23 septembre',
  subjectName: (id: string) => (id === 'mkt' ? 'Marketing' : 'Finance'),
  weekdayShort: (n: number) =>
    ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'][n - 1] ?? '',
  monthTitle: () => 'Septembre 2026',
  duration: (m: number) => `${m} min`,
  locale: 'fr',
};
const themes = { light: lightColors, dark: darkColors };

describe('données des widgets', () => {
  it('calcule le prochain cours, les tâches du jour / en retard et les examens proches', () => {
    const w = buildWidgetData(data, subjects, now, texts, themes);
    expect(w.date).toBe('Mercredi 23 septembre');
    expect(w.next?.title).toBe('Marketing');
    expect(w.labels.startsIn).toBe('widget.inMinutes{"count":30}');
    expect(w.courses.map((c) => c.title)).toEqual(['Marketing', 'TD Finance']);
    expect(w.tasks.map((t) => [t.title, t.overdue])).toEqual([['Étude de cas', true]]);
    expect(w.moreTasks).toBe(0);
    expect(w.exams).toEqual([{ title: 'Marketing', when: 'countdown.inDays{"count":2}' }]);
    expect(w.light.primary).toBe(lightColors.primary);
    expect(w.url).toBe('mysky://');
  });

  it('passe au cours suivant pendant une séance, puis à « aucun » après le dernier', () => {
    const during = buildWidgetData(data, subjects, new Date(2026, 8, 23, 10, 0), texts, themes);
    expect(during.next?.ongoing).toBe(true);
    expect(during.labels.startsIn).toBe('widget.ongoing');
    const later = buildWidgetData(data, subjects, new Date(2026, 8, 23, 12, 0), texts, themes);
    expect(later.next?.title).toBe('TD Finance');
    expect(later.labels.startsIn).toBe('widget.inHours{"hours":2,"minutes":"00"}');
    const evening = buildWidgetData(data, subjects, new Date(2026, 8, 23, 17, 0), texts, themes);
    expect(evening.next).toBeNull();
  });

  it('prévoit une entrée de chronologie à chaque début et fin de séance, puis à minuit', () => {
    const entries = buildWidgetTimeline(data, subjects, now, texts, themes);
    const hours = entries.map((e) => `${e.date.getHours()}:${e.date.getMinutes()}`);
    expect(hours).toEqual(['8:30', '9:0', '11:0', '14:0', '16:0', '0:0']);
    expect(entries[1]?.props.next?.ongoing).toBe(true);
    expect(entries[5]?.props.courses).toEqual([]);
  });

  it('prépare les données des autres widgets : révision, semaine, matières, notes, examens, mois', () => {
    const session = {
      id: 'st',
      subjectId: 'mkt',
      startedAt: new Date(2026, 8, 23, 8, 20).toISOString(),
      endedAt: null,
      plannedMinutes: 25,
      kind: 'focus' as const,
    };
    const graded = {
      ...data.exams[0]!,
      id: 'e0',
      title: 'Contrôle',
      date: '2026-09-15',
      grade: 15,
    };
    const w = buildWidgetData(
      { ...data, studySession: session, exams: [...data.exams, graded] },
      subjects,
      now,
      texts,
      themes,
      {
        sessions: [
          {
            ...session,
            endedAt: new Date(2026, 8, 22, 9, 0).toISOString(),
            id: 'old',
            startedAt: new Date(2026, 8, 22, 8, 0).toISOString(),
          },
        ],
        weekStart: 1,
      },
    );
    expect(w.study).toMatchObject({
      kind: 'focus',
      subject: 'Marketing',
      endsAtTime: '08:45',
      plannedMinutes: 25,
    });
    expect(w.week.days.map((d) => d.minutes)).toEqual([0, 60, 0, 0, 0, 0, 0]);
    expect(w.week.days[2]?.today).toBe(true);
    expect(w.week.total).toBe('60 min');
    const mkt = w.subjects.find((s) => s.id === 'mkt')!;
    expect(mkt).toMatchObject({
      name: 'Marketing',
      nextCourse: '09:00',
      nextCourseRoom: 'B12',
      openTasks: 1,
      average: '15',
    });
    expect(mkt.nextDue).toBe('Étude de cas · mar.');
    expect(w.subjects.find((s) => s.id === 'fin')?.nextCourse).toBe('14:00');
    expect(w.grades.overall).toBe('15');
    expect(w.grades.last).toEqual({ title: 'Contrôle', subject: 'Marketing', value: '15' });
    expect(w.upcomingExams.map((e) => e.when)).toEqual(['countdown.inDays{"count":2}']);
    expect(w.month.title).toBe('Septembre 2026');
    expect(w.month.cells).toHaveLength(42);
    const todayCell = w.month.cells.find((c) => c.today)!;
    expect(todayCell).toMatchObject({ day: 23, inMonth: true, course: true });
    expect(w.month.cells.find((c) => c.inMonth && c.day === 25)?.exam).toBe(true);
    expect(w.month.cells.find((c) => c.inMonth && c.day === 22)?.due).toBe(true);
    expect(w.links.note).toBe('mysky://notes/new');
  });

  it('ajoute la fin de session de révision à la chronologie', () => {
    const session = {
      id: 'st',
      subjectId: null,
      startedAt: new Date(2026, 8, 23, 8, 20).toISOString(),
      endedAt: null,
      plannedMinutes: 25,
      kind: 'focus' as const,
    };
    const entries = buildWidgetTimeline(
      { ...data, studySession: session },
      subjects,
      now,
      texts,
      themes,
    );
    expect(entries.map((e) => `${e.date.getHours()}:${e.date.getMinutes()}`)).toContain('8:45');
  });

  it('liste les habitudes du jour pour le widget « Habitudes »', () => {
    const habitBase = {
      icon: 'check-circle',
      frequency: 'daily' as const,
      weekdays: [],
      timesPerWeek: 1,
      unit: null,
      reminderTime: null,
      autoStudy: false,
      position: 0,
    };
    const w = buildWidgetData(
      {
        ...data,
        habits: [
          { ...habitBase, id: 'a', name: 'Eau', colorId: 'teal', target: 8 },
          { ...habitBase, id: 'b', name: 'Lire', colorId: 'blue', target: 1 },
          {
            ...habitBase,
            id: 'c',
            name: 'Week-end',
            colorId: 'blue',
            target: 1,
            frequency: 'weekdays',
            weekdays: [6, 7],
          },
        ],
        habitLogs: [
          {
            id: 'l1',
            habitId: 'a',
            date: '2026-09-23',
            count: 3,
            status: 'done',
            reasonCode: null,
            reason: null,
          },
          {
            id: 'l2',
            habitId: 'b',
            date: '2026-09-23',
            count: 1,
            status: 'done',
            reasonCode: null,
            reason: null,
          },
        ],
      },
      subjects,
      now,
      texts,
      themes,
    );
    expect(w.habits.map((h) => [h.name, h.done, h.progress])).toEqual([
      ['Eau', false, '3/8'],
      ['Lire', true, ''],
    ]);
  });
});
