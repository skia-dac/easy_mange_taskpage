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
    },
  ],
};
const subjects = new Map([
  ['mkt', { id: 'mkt', name: 'Marketing' }],
  ['fin', { id: 'fin', name: 'Finance' }],
]) as never;
const texts = {
  t: (key: string, params?: Record<string, string | number>) =>
    `${key}${params ? JSON.stringify(params) : ''}`,
  formatDate: () => 'Mercredi 23 septembre',
  subjectName: (id: string) => (id === 'mkt' ? 'Marketing' : 'Finance'),
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
});
