import type { TodayData } from '@/projections';

import { buildIcs, icsEscape } from './ics';

const now = new Date(2026, 8, 23, 10, 0);
const data: TodayData = {
  series: [
    {
      id: 'c1',
      subjectId: 'mkt',
      timetableId: null,
      title: null,
      teacher: 'Prof. Martin',
      room: 'B12',
      courseType: 'lecture',
      recurrence: 'weekly',
      weekday: 3,
      validFrom: '2026-09-23',
      validUntil: '2026-09-30',
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
      newDate: null,
      newStartTime: null,
      newEndTime: null,
      newRoom: null,
      newTeacher: null,
      newTitle: null,
      note: null,
    },
  ],
  exams: [
    {
      id: 'e1',
      subjectId: 'mkt',
      title: 'Partiel, chap. 1;2',
      date: '2026-10-12',
      time: '09:00',
      durationMinutes: 90,
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
  events: [
    {
      id: 'ev',
      title: 'Dentiste',
      date: '2026-09-25',
      startTime: null,
      endTime: null,
      description: null,
      reminderAt: null,
    },
  ],
  work: [
    {
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
      reminderAt: null,
      repeat: 'none',
      estimatedMinutes: null,
    },
    {
      id: 'w2',
      kind: 'task',
      title: 'Faite',
      description: null,
      subjectId: null,
      dueDate: '2026-09-29',
      dueTime: null,
      priority: 'normal',
      status: 'done',
      completedAt: null,
      reminderAt: null,
      repeat: 'none',
      estimatedMinutes: null,
    },
  ],
};
const labels = {
  subjectName: () => 'Marketing',
  exam: 'Examen',
  assignment: 'Devoir',
  revision: 'Révision',
  task: 'Tâche',
};

describe('export .ics', () => {
  const ics = buildIcs(data, labels, now);

  it('produit un calendrier valide avec cours, examens, événements et devoirs', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:course-c1-2026-09-23@mysky');
    expect(ics).toContain('DTSTART:20260923T090000');
    expect(ics).toContain('LOCATION:B12');
    expect(ics).toContain('SUMMARY:Examen : Partiel\\, chap. 1\;2');
    expect(ics).toContain('DTEND:20261012T103000');
    expect(ics).toContain('DTSTART;VALUE=DATE:20260925');
    expect(ics).toContain('SUMMARY:Devoir : Étude de cas');
  });

  it('ignore les séances annulées et les tâches terminées', () => {
    expect(ics).not.toContain('course-c1-2026-09-30');
    expect(ics).not.toContain('Faite');
  });

  it('échappe le texte et plie les longues lignes', () => {
    expect(icsEscape('a,b;c\nd')).toBe('a\\,b\;c\\nd');
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});
