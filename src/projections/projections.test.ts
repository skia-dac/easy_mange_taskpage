import type { CourseSeries, Exam, Occurrence } from '@/modules/academic';
import type { WorkItem } from '@/modules/productivity';

import { calendarDays } from './calendar';
import { buildToday, nextCourse } from './today';

const occ = (start: string, end: string, id = start): Occurrence => ({
  seriesId: id,
  subjectId: 'mkt',
  date: '2026-09-23',
  startTime: start,
  endTime: end,
  title: null,
  teacher: null,
  room: null,
  courseType: 'lecture',
  recurrence: 'weekly',
  status: 'normal',
  exceptionId: null,
  note: null,
});

describe('prochain cours (§8, critère 16)', () => {
  const day = [occ('09:00', '11:00'), occ('14:00', '16:00')];

  it('avant le premier cours : « dans X minutes »', () => {
    expect(nextCourse(day, new Date(2026, 8, 23, 8, 25))).toMatchObject({
      state: 'upcoming',
      minutes: 35,
    });
  });

  it('pendant un cours : « en cours, se termine dans X minutes »', () => {
    const r = nextCourse(day, new Date(2026, 8, 23, 10, 18));
    expect(r).toMatchObject({ state: 'ongoing', minutes: 42 });
    expect(r?.occurrence.startTime).toBe('09:00');
  });

  it('entre deux cours : le suivant', () => {
    expect(nextCourse(day, new Date(2026, 8, 23, 12, 0))?.occurrence.startTime).toBe('14:00');
  });

  it('après le dernier cours : aucun', () => {
    expect(nextCourse(day, new Date(2026, 8, 23, 16, 0))).toBeNull();
  });

  it('ignore une séance annulée', () => {
    const cancelled = [
      { ...occ('09:00', '11:00'), status: 'cancelled' as const },
      occ('14:00', '16:00'),
    ];
    expect(nextCourse(cancelled, new Date(2026, 8, 23, 8, 0))?.occurrence.startTime).toBe('14:00');
  });
});

const series: CourseSeries = {
  id: 's',
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
};
const work = (over: Partial<WorkItem>): WorkItem => ({
  id: 'w',
  kind: 'task',
  title: 'T',
  description: null,
  subjectId: null,
  dueDate: '2026-09-23',
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  reminderAt: null,
  repeat: 'none',
  ...over,
});
const exam = (id: string, date: string): Exam => ({
  id,
  subjectId: 'fin',
  title: null,
  date,
  time: '09:00',
  durationMinutes: null,
  room: null,
  description: null,
  reminderDays: [],
  reminderTime: '09:00',
  grade: null,
  gradeMax: 20,
  coefficient: 1,
});

describe('Aujourd’hui (§7–11)', () => {
  const now = new Date(2026, 8, 23, 8, 0);
  const view = buildToday(
    {
      series: [series],
      exams: [exam('near', '2026-10-12'), exam('far', '2026-12-15'), exam('past', '2026-09-01')],
      work: [
        work({ id: 'today' }),
        work({ id: 'late', dueDate: '2026-09-20' }),
        work({ id: 'done-late', dueDate: '2026-09-20', status: 'done' }),
        work({ id: 'future', dueDate: '2026-09-30' }),
      ],
      events: [],
    },
    now,
  );

  it('liste les cours du jour et le prochain cours', () => {
    expect(view.courses).toHaveLength(1);
    expect(view.next?.state).toBe('upcoming');
  });

  it('sépare « en retard » et « aujourd’hui », sans les éléments terminés ou futurs', () => {
    expect(view.overdue.map((w) => w.id)).toEqual(['late']);
    expect(view.dueToday.map((w) => w.id)).toEqual(['today']);
  });

  it('montre les examens proches seulement, avec compte à rebours', () => {
    expect(view.upcomingExams.map((e) => e.exam.id)).toEqual(['near']);
    expect(view.upcomingExams[0]?.countdown).toEqual({ kind: 'inDays', days: 19 });
  });
});

it('le calendrier rassemble cours, examens et échéances par jour (critère 14)', () => {
  const days = calendarDays(
    {
      series: [series],
      exams: [exam('e', '2026-09-24')],
      work: [work({ dueDate: '2026-09-24', dueTime: '18:00' })],
      events: [],
    },
    '2026-09-21',
    '2026-09-27',
  );
  expect(days.size).toBe(7);
  expect(days.get('2026-09-23')?.map((i) => i.kind)).toEqual(['course']);
  expect(days.get('2026-09-24')?.map((i) => i.kind)).toEqual(['exam', 'work']);
  expect(days.get('2026-09-25')).toEqual([]);
});

it('le calendrier affiche les vacances et masque les cours suspendus (§37, §42)', () => {
  const holiday = {
    id: 'h',
    name: 'Toussaint',
    kind: 'holiday' as const,
    startDate: '2026-10-24',
    endDate: '2026-11-02',
    suspendCourses: true,
  };
  const days = calendarDays(
    { series: [series], exams: [], work: [], events: [], offPeriods: [holiday] },
    '2026-10-26',
    '2026-10-28',
  );
  expect(days.get('2026-10-28')?.map((i) => i.kind)).toEqual(['dayOff']);
  const kept = calendarDays(
    {
      series: [series],
      exams: [],
      work: [],
      events: [],
      offPeriods: [{ ...holiday, suspendCourses: false }],
    },
    '2026-10-28',
    '2026-10-28',
  );
  expect(kept.get('2026-10-28')?.map((i) => i.kind)).toEqual(['dayOff', 'course']);
});
