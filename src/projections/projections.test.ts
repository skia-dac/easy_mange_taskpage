import type { CourseSeries, Exam, Occurrence } from '@/modules/academic';
import type { WorkItem } from '@/modules/productivity';

import { calendarDays } from './calendar';
import { buildDayLine, buildToday, nextCourse } from './today';

const occ = (start: string, end: string, id = start): Occurrence => ({
  seriesId: id,
  subjectId: 'mkt',
  date: '2026-09-23',
  originalDate: '2026-09-23',
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
  estimatedMinutes: null,
  space: 'personal',
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
  timetableId: null,
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

describe('« Ta journée » : le fil du temps', () => {
  const base = {
    today: '2026-09-23',
    courses: [occ('11:00', '13:00', 'mkt'), occ('08:00', '09:00', 'eco')],
    events: [
      {
        id: 'e1',
        title: 'Réunion asso',
        date: '2026-09-23',
        startTime: '18:30',
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'personal' as const,
      },
      {
        id: 'e2',
        title: 'Anniversaire',
        date: '2026-09-23',
        startTime: null,
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'personal' as const,
      },
    ],
    overdue: [],
    dueToday: [work({ id: 'w1', dueTime: '14:00' }), work({ id: 'w2', dueTime: null })],
  };
  const blocks = [
    {
      id: 'r1',
      subjectId: null,
      examId: null,
      timetableId: null,
      date: '2026-09-23',
      startTime: '17:00',
      endTime: '18:00',
      title: null,
      status: 'planned' as const,
      studySessionId: null,
    },
    {
      id: 'r2',
      subjectId: null,
      examId: null,
      timetableId: null,
      date: '2026-09-23',
      startTime: '19:00',
      endTime: '20:00',
      title: null,
      status: 'skipped' as const,
      studySessionId: null,
    },
  ];

  it('trie par heure, garde les tâches avec heure et met les événements sans heure à part', () => {
    const line = buildDayLine(base, blocks, new Date(2026, 8, 23, 10, 18));
    expect(line.entries.map((e) => e.start)).toEqual(['08:00', '11:00', '14:00', '17:00', '18:30']);
    expect(line.allDay.map((e) => e.key)).toEqual(['event-e2']);
  });

  it('place « maintenant » entre ce qui a commencé et la suite, et marque le passé', () => {
    const line = buildDayLine(base, blocks, new Date(2026, 8, 23, 10, 18));
    expect(line.nowIndex).toBe(1);
    expect([...line.pastKeys]).toEqual(['course-eco-2026-09-23']);
  });

  it('ignore les cours annulés et les révisions sautées', () => {
    const line = buildDayLine(
      { ...base, courses: [{ ...occ('11:00', '13:00'), status: 'cancelled' }] },
      blocks,
      new Date(2026, 8, 23, 7, 0),
    );
    expect(line.entries.some((e) => e.kind === 'course')).toBe(false);
    expect(line.entries.filter((e) => e.kind === 'revision')).toHaveLength(1);
    expect(line.nowIndex).toBe(0);
  });
});
