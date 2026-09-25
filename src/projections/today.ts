import {
  countdown,
  occurrencesInRange,
  type Countdown,
  type CourseException,
  type CourseSeries,
  type Exam,
  type Occurrence,
  type OffPeriod,
} from '@/modules/academic';
import {
  compareWorkItems,
  isOverdue,
  type PersonalEvent,
  type WorkItem,
  type Habit,
  type HabitLog,
  type StudySession,
  type RevisionBlock,
  type MoodLog,
} from '@/modules/productivity';
import type { Recurring, Transaction } from '@/modules/finance';
import {
  addDaysIso,
  atTime,
  timeToMinutes,
  toIsoDate,
  type IsoDate,
  type Time,
} from '@/shared/dates';

export type NextCourse =
  | { state: 'upcoming'; occurrence: Occurrence; minutes: number }
  | { state: 'ongoing'; occurrence: Occurrence; minutes: number };

/**
 * Le prochain cours du jour (§8) :
 * - « en cours » s'il a commencé et n'est pas fini (minutes = temps restant) ;
 * - sinon le prochain qui n'a pas commencé (minutes = temps avant le début).
 * Les séances annulées sont ignorées.
 */
export function nextCourse(todayOccurrences: readonly Occurrence[], now: Date): NextCourse | null {
  const t = now.getTime();
  for (const o of todayOccurrences) {
    if (o.status === 'cancelled') continue;
    const start = atTime(o.date, o.startTime).getTime();
    const end = atTime(o.date, o.endTime).getTime();
    if (t >= end) continue;
    if (t >= start)
      return { state: 'ongoing', occurrence: o, minutes: Math.ceil((end - t) / 60000) };
    return { state: 'upcoming', occurrence: o, minutes: Math.ceil((start - t) / 60000) };
  }
  return null;
}

export type TodayData = {
  series: readonly CourseSeries[];
  exceptions?: readonly CourseException[];
  offPeriods?: readonly OffPeriod[];
  exams: readonly Exam[];
  work: readonly WorkItem[];
  events: readonly PersonalEvent[];
  /** Session de révision en cours (minuteur), s'il y en a une. */
  studySession?: StudySession | null;
  habits?: readonly Habit[];
  /** Journal des habitudes (des 60 derniers jours à aujourd'hui). */
  habitLogs?: readonly HabitLog[];
  /** Séances de révision prévues (plan de révision, ajout manuel). */
  revisionBlocks?: readonly RevisionBlock[];
  /** Humeur des derniers jours (bilan du soir, statistiques). */
  moodLogs?: readonly MoodLog[];
  /** Charges fixes et tontines, et leurs paiements récents (rappels). */
  money?: { recurring: readonly Recurring[]; payments: readonly Transaction[] };
};

export type TodayView = {
  today: IsoDate;
  /** Vacances ou jour sans cours qui couvre aujourd'hui. */
  dayOff: OffPeriod | null;
  next: NextCourse | null;
  courses: Occurrence[];
  overdue: WorkItem[];
  dueToday: WorkItem[];
  upcomingExams: { exam: Exam; countdown: Countdown }[];
  events: PersonalEvent[];
};

/** Nombre de jours à l'avance où un examen apparaît dans « Aujourd'hui ». */
export const EXAM_HORIZON_DAYS = 30;

/** Tout ce qui concerne la journée (§7) : calculé, jamais stocké (architecture §10.1). */
export function buildToday(data: TodayData, now: Date): TodayView {
  const today = toIsoDate(now);
  const courses = occurrencesInRange(data.series, today, today, data);
  const open = data.work.filter((w) => w.status !== 'done');
  const overdue = open.filter((w) => isOverdue(w, now)).sort(compareWorkItems);
  const dueToday = open
    .filter((w) => w.dueDate === today && !isOverdue(w, now))
    .sort(compareWorkItems);
  const horizon = addDaysIso(today, EXAM_HORIZON_DAYS);
  const upcomingExams = data.exams
    .filter((e) => e.date >= today && e.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .map((exam) => ({ exam, countdown: countdown(exam.date, today) }));
  const events = data.events
    .filter((e) => e.date === today)
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const dayOff =
    (data.offPeriods ?? []).find((p) => p.startDate <= today && today <= p.endDate) ?? null;
  return {
    today,
    dayOff,
    next: nextCourse(courses, now),
    courses,
    overdue,
    dueToday,
    upcomingExams,
    events,
  };
}

/** Un moment de « Ta journée » : tout ce qui a une heure aujourd'hui, dans l'ordre. */
export type DayEntry =
  | { kind: 'course'; key: string; start: Time; end: Time; occurrence: Occurrence }
  | { kind: 'revision'; key: string; start: Time; end: Time; block: RevisionBlock }
  | { kind: 'event'; key: string; start: Time | null; end: Time | null; event: PersonalEvent }
  | { kind: 'work'; key: string; start: Time; end: null; item: WorkItem };

export type DayLine = {
  /** Événements sans heure (toute la journée), affichés avant le fil. */
  allDay: DayEntry[];
  entries: DayEntry[];
  /** Position du trait « maintenant » : nombre de moments déjà commencés. */
  nowIndex: number;
  /** Moments terminés (affichés en plus discret). */
  pastKeys: ReadonlySet<string>;
};

/**
 * Le fil de la journée (§7) : cours (non annulés), séances de révision prévues, événements et
 * tâches avec une heure limite, triés par heure. Les tâches sans heure restent dans « À faire ».
 */
export function buildDayLine(
  view: Pick<TodayView, 'today' | 'courses' | 'events' | 'overdue' | 'dueToday'>,
  revisionBlocks: readonly RevisionBlock[],
  now: Date,
): DayLine {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const timed: DayEntry[] = [];
  const allDay: DayEntry[] = [];
  for (const o of view.courses) {
    if (o.status === 'cancelled') continue;
    timed.push({
      kind: 'course',
      key: `course-${o.seriesId}-${o.originalDate}`,
      start: o.startTime,
      end: o.endTime,
      occurrence: o,
    });
  }
  for (const b of revisionBlocks) {
    if (b.date !== view.today || b.status === 'skipped') continue;
    timed.push({
      kind: 'revision',
      key: `revision-${b.id}`,
      start: b.startTime,
      end: b.endTime,
      block: b,
    });
  }
  for (const e of view.events) {
    const entry: DayEntry = {
      kind: 'event',
      key: `event-${e.id}`,
      start: e.startTime ?? null,
      end: e.endTime ?? null,
      event: e,
    };
    (e.startTime ? timed : allDay).push(entry);
  }
  for (const w of [...view.overdue, ...view.dueToday]) {
    if (w.dueDate !== view.today || !w.dueTime) continue;
    timed.push({
      kind: 'work',
      key: `work-${w.kind}-${w.id}`,
      start: w.dueTime,
      end: null,
      item: w,
    });
  }
  const startOf = (e: DayEntry) => timeToMinutes(e.start ?? '00:00');
  timed.sort((a, b) => startOf(a) - startOf(b) || a.key.localeCompare(b.key));
  const nowIndex = timed.filter((e) => startOf(e) <= nowMin).length;
  const pastKeys = new Set(
    timed
      .filter((e) => (e.end ? timeToMinutes(e.end) : startOf(e)) <= nowMin && e.kind !== 'work')
      .map((e) => e.key),
  );
  return { allDay, entries: timed, nowIndex, pastKeys };
}
