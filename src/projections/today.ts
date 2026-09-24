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
  type StudySession,
} from '@/modules/productivity';
import { addDaysIso, atTime, toIsoDate, type IsoDate } from '@/shared/dates';

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
