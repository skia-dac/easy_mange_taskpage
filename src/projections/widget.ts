import {
  colorOf,
  countdown,
  formatGrade,
  gradesBySubject,
  occurrencesInRange,
  overallAverage,
  type Occurrence,
  type Subject,
} from '@/modules/academic';
import {
  compareWorkItems,
  isDone,
  isOverdue,
  isScheduledOn,
  logOn,
  plannedEnd,
  type StudySession,
} from '@/modules/productivity';
import {
  addDaysIso,
  atTime,
  fromIsoDate,
  isoWeekday,
  startOfWeekOn,
  toIsoDate,
  toTime,
  weekdayOrder,
  type IsoDate,
} from '@/shared/dates';
import { subjectColors, type ColorTokens } from '@/shared/theme';

import { weekStats } from './stats';
import type { TodayData } from './today';

/**
 * Données affichées par les widgets de l'écran d'accueil (iPhone et Android).
 * Un widget tourne hors de l'app, sans accès à la base, aux traductions ni au thème :
 * tout ce qu'il affiche (textes déjà traduits, couleurs) est calculé ici et lui est transmis.
 */
export type WidgetTheme = Pick<
  ColorTokens,
  'background' | 'surface' | 'text' | 'muted' | 'primary' | 'primarySoft' | 'danger' | 'success'
>;

export type WidgetCourse = {
  title: string;
  start: string;
  end: string;
  room: string;
  cancelled: boolean;
  /** Séance en cours au moment de l'entrée. */
  ongoing: boolean;
};

export type WidgetTask = { title: string; subject: string; overdue: boolean; due: string };

export type WidgetStudy = {
  kind: 'focus' | 'break';
  subject: string;
  startedAt: string;
  endsAt: string;
  /** « 10:25 » */
  endsAtTime: string;
  plannedMinutes: number;
};

export type WidgetSubject = {
  id: string;
  name: string;
  color: string;
  average: string | null;
  /** « mer. 09:00 » ou '' */
  nextCourse: string;
  nextCourseRoom: string;
  openTasks: number;
  /** Prochaine échéance (devoir ou tâche) : « Étude de cas · jeu. » */
  nextDue: string;
  nextExam: string;
};

export type WidgetMonthCell = {
  day: number;
  inMonth: boolean;
  today: boolean;
  course: boolean;
  due: boolean;
  exam: boolean;
};

export type WidgetHabit = { name: string; done: boolean; progress: string; color: string };

export type WidgetLabels = {
  nextCourse: string;
  noCourse: string;
  ongoing: string;
  /** « dans 25 min » */
  startsIn: string;
  today: string;
  tasks: string;
  noTask: string;
  overdue: string;
  exams: string;
  cancelled: string;
  more: string;
  study: string;
  studyRunning: string;
  breakRunning: string;
  studyIdle: string;
  studyStart: string;
  untilTime: string;
  week: string;
  weekTotal: string;
  streak: string;
  subject: string;
  subjectPick: string;
  subjectNone: string;
  noExam: string;
  quickNote: string;
  quickTask: string;
  quickAssignment: string;
  grades: string;
  noGrade: string;
  lastGrade: string;
  overall: string;
  month: string;
  habits: string;
  noHabit: string;
};

export type WidgetLinks = {
  app: string;
  note: string;
  task: string;
  assignment: string;
  study: string;
  grades: string;
  calendar: string;
  tasks: string;
  habits: string;
};

export type WidgetData = {
  /** « Mercredi 23 septembre », déjà formaté. */
  date: string;
  next: WidgetCourse | null;
  courses: WidgetCourse[];
  tasks: WidgetTask[];
  /** Nombre de tâches non affichées (au-delà de la limite). */
  moreTasks: number;
  exams: { title: string; when: string }[];
  /** Examens des 60 prochains jours (widget « Examens »). */
  upcomingExams: { title: string; subject: string; when: string; date: string }[];
  study: WidgetStudy | null;
  week: {
    days: { label: string; minutes: number; today: boolean }[];
    max: number;
    total: string;
    streak: string;
  };
  subjects: WidgetSubject[];
  grades: {
    overall: string | null;
    last: { title: string; subject: string; value: string } | null;
    subjects: { name: string; average: string; color: string }[];
  };
  month: { title: string; weekdays: string[]; cells: WidgetMonthCell[] };
  habits: WidgetHabit[];
  labels: WidgetLabels;
  links: WidgetLinks;
  light: WidgetTheme;
  dark: WidgetTheme;
  /** Lien ouvert quand on touche le widget. */
  url: string;
};

/** Ce que les widgets ont besoin de savoir en plus de l'agenda. */
export type WidgetExtras = {
  sessions: readonly StudySession[];
  weekStart: number;
  scheme?: 'light' | 'dark';
};

export const WIDGET_LINKS: WidgetLinks = {
  app: WIDGET_URL_BASE(),
  note: `${WIDGET_URL_BASE()}notes/new`,
  task: `${WIDGET_URL_BASE()}work/form?kind=task`,
  assignment: `${WIDGET_URL_BASE()}work/form?kind=assignment`,
  study: `${WIDGET_URL_BASE()}study`,
  grades: `${WIDGET_URL_BASE()}grades`,
  calendar: `${WIDGET_URL_BASE()}calendar`,
  tasks: `${WIDGET_URL_BASE()}tasks`,
  habits: `${WIDGET_URL_BASE()}habits`,
};

function WIDGET_URL_BASE(): string {
  return 'mysky://';
}

export const WIDGET_URL = 'mysky://';
export const WIDGET_MAX_COURSES = 5;
export const WIDGET_MAX_TASKS = 5;
export const WIDGET_MAX_EXAMS = 3;

export type WidgetTexts = {
  /** Traduction d'une clé de `widget.*` (et `countdown.*`). */
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (d: Date) => string;
  subjectName: (id: string) => string;
  /** « mer. » */
  weekdayShort: (isoWeekday: number) => string;
  /** « Septembre 2026 » */
  monthTitle: (day: IsoDate) => string;
  /** « 2 h 05 » */
  duration: (minutes: number) => string;
  locale: string;
};

export function pickWidgetTheme(colors: ColorTokens): WidgetTheme {
  return {
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    muted: colors.muted,
    primary: colors.primary,
    primarySoft: colors.primarySoft,
    danger: colors.danger,
    success: colors.success,
  };
}

function toCourse(o: Occurrence, texts: WidgetTexts, now: Date): WidgetCourse {
  const start = atTime(o.date, o.startTime).getTime();
  const end = atTime(o.date, o.endTime).getTime();
  return {
    title: o.title ?? texts.subjectName(o.subjectId),
    start: o.startTime,
    end: o.endTime,
    room: o.room ?? '',
    cancelled: o.status === 'cancelled',
    ongoing: o.status !== 'cancelled' && start <= now.getTime() && now.getTime() < end,
  };
}

/** « dans 25 min », « dans 2 h 05 », « en cours ». */
function startsIn(o: WidgetCourse, day: string, now: Date, texts: WidgetTexts): string {
  if (o.ongoing) return texts.t('widget.ongoing');
  const minutes = Math.max(
    0,
    Math.round((atTime(day, o.start).getTime() - now.getTime()) / 60_000),
  );
  if (minutes < 60) return texts.t('widget.inMinutes', { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return texts.t('widget.inHours', { hours: h, minutes: String(m).padStart(2, '0') });
}

const EMPTY_EXTRAS: WidgetExtras = { sessions: [], weekStart: 1 };

function buildStudy(data: TodayData, texts: WidgetTexts): WidgetStudy | null {
  const s = data.studySession;
  if (!s || s.endedAt !== null) return null;
  const end = plannedEnd(s);
  return {
    kind: s.kind,
    subject: s.subjectId ? texts.subjectName(s.subjectId) : '',
    startedAt: s.startedAt,
    endsAt: end.toISOString(),
    endsAtTime: toTime(end),
    plannedMinutes: s.plannedMinutes,
  };
}

function buildWeek(
  data: TodayData,
  extras: WidgetExtras,
  now: Date,
  texts: WidgetTexts,
): WidgetData['week'] {
  const today = toIsoDate(now);
  const from = startOfWeekOn(today, extras.weekStart);
  const stats = weekStats(data, extras.sessions, from, now);
  const days = weekdayOrder(extras.weekStart).map((n, i) => ({
    label: texts.weekdayShort(n),
    minutes: stats.studyByDay[i]?.minutes ?? 0,
    today: stats.studyByDay[i]?.day === today,
  }));
  return {
    days,
    max: Math.max(60, ...days.map((d) => d.minutes)),
    total: texts.duration(stats.studyMinutes),
    streak: texts.t('widget.streakDays', { count: stats.streakDays }),
  };
}

function buildSubjects(
  data: TodayData,
  subjects: ReadonlyMap<string, Subject>,
  now: Date,
  texts: WidgetTexts,
  scheme: 'light' | 'dark',
): WidgetSubject[] {
  const today = toIsoDate(now);
  const until = addDaysIso(today, 14);
  const occurrences = occurrencesInRange(data.series, today, until, data).filter(
    (o) => o.status !== 'cancelled' && atTime(o.date, o.endTime).getTime() > now.getTime(),
  );
  const grades = new Map(gradesBySubject(data.exams).map((g) => [g.subjectId, g]));
  return [...subjects.values()].slice(0, 12).map((s) => {
    const next = occurrences.find((o) => o.subjectId === s.id);
    const work = data.work
      .filter((w) => w.subjectId === s.id && w.status !== 'done')
      .sort(compareWorkItems);
    const due = work[0];
    const exam = data.exams
      .filter((e) => e.subjectId === s.id && e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const c = colorOf(s);
    const average = grades.get(s.id)?.average ?? null;
    return {
      id: s.id,
      name: s.name,
      color: scheme === 'dark' ? c.strongDark : c.strong,
      average: average === null ? null : formatGrade(average, texts.locale),
      nextCourse: next
        ? `${next.date === today ? '' : `${texts.weekdayShort(isoWeekday(next.date))} `}${next.startTime}`
        : '',
      nextCourseRoom: next?.room ?? '',
      openTasks: work.length,
      nextDue: due ? `${due.title} · ${texts.weekdayShort(isoWeekday(due.dueDate))}` : '',
      nextExam: exam ? examWhen(exam.date, today, texts) : '',
    };
  });
}

function examWhen(date: IsoDate, today: IsoDate, texts: WidgetTexts): string {
  const c = countdown(date, today);
  return c.kind === 'inDays'
    ? texts.t('countdown.inDays', { count: c.days })
    : texts.t(`countdown.${c.kind}`);
}

function buildGrades(
  data: TodayData,
  subjects: ReadonlyMap<string, Subject>,
  texts: WidgetTexts,
  scheme: 'light' | 'dark',
): WidgetData['grades'] {
  const by = gradesBySubject(data.exams);
  const overall = overallAverage(by);
  const graded = data.exams
    .filter((e) => e.grade !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const last = graded[0];
  return {
    overall: overall === null ? null : formatGrade(overall, texts.locale),
    last: last
      ? {
          title: last.title ?? texts.subjectName(last.subjectId),
          subject: texts.subjectName(last.subjectId),
          value: formatGrade(((last.grade ?? 0) / last.gradeMax) * 20, texts.locale),
        }
      : null,
    subjects: by
      .filter((g) => g.average !== null)
      .slice(0, 6)
      .map((g) => {
        const s = subjects.get(g.subjectId);
        const c = colorOf(s);
        return {
          name: s?.name ?? '',
          average: formatGrade(g.average ?? 0, texts.locale),
          color: scheme === 'dark' ? c.strongDark : c.strong,
        };
      }),
  };
}

function buildMonth(
  data: TodayData,
  extras: WidgetExtras,
  now: Date,
  texts: WidgetTexts,
): WidgetData['month'] {
  const today = toIsoDate(now);
  const first: IsoDate = `${today.slice(0, 7)}-01`;
  const start = startOfWeekOn(first, extras.weekStart);
  const end = addDaysIso(start, 41);
  const courseDays = new Set(
    occurrencesInRange(data.series, start, end, data)
      .filter((o) => o.status !== 'cancelled')
      .map((o) => o.date),
  );
  const dueDays = new Set(
    data.work
      .filter((w) => w.status !== 'done')
      .map((w) => w.dueDate)
      .concat(data.events.map((e) => e.date)),
  );
  const examDays = new Set(data.exams.map((e) => e.date));
  const cells: WidgetMonthCell[] = Array.from({ length: 42 }, (_, i) => {
    const day = addDaysIso(start, i);
    return {
      day: fromIsoDate(day).getDate(),
      inMonth: day.slice(0, 7) === today.slice(0, 7),
      today: day === today,
      course: courseDays.has(day),
      due: dueDays.has(day),
      exam: examDays.has(day),
    };
  });
  return {
    title: texts.monthTitle(today),
    weekdays: weekdayOrder(extras.weekStart).map((n) => texts.weekdayShort(n)),
    cells,
  };
}

function buildHabits(data: TodayData, today: IsoDate, scheme: 'light' | 'dark'): WidgetHabit[] {
  const logs = data.habitLogs ?? [];
  return (data.habits ?? [])
    .filter((h) => isScheduledOn(h, today))
    .slice(0, 8)
    .map((h) => {
      const log = logOn(logs, h.id, today);
      const count = log?.status === 'done' ? log.count : 0;
      const c = subjectColors.find((x) => x.id === h.colorId) ?? subjectColors[0]!;
      return {
        name: h.name,
        done: isDone(h, log),
        progress: h.target > 1 ? `${count}/${h.target}` : '',
        color: scheme === 'dark' ? c.strongDark : c.strong,
      };
    });
}

export function buildWidgetData(
  data: TodayData,
  subjects: ReadonlyMap<string, Subject>,
  now: Date,
  texts: WidgetTexts,
  themes: { light: ColorTokens; dark: ColorTokens },
  extras: WidgetExtras = EMPTY_EXTRAS,
): WidgetData {
  const today = toIsoDate(now);
  const scheme = extras.scheme ?? 'light';
  const occurrences = occurrencesInRange(data.series, today, today, data);
  const courses = occurrences.map((o) => toCourse(o, texts, now));
  const next =
    courses.find(
      (c) => !c.cancelled && (c.ongoing || atTime(today, c.start).getTime() > now.getTime()),
    ) ?? null;

  const open = data.work
    .filter((w) => w.status !== 'done' && (w.dueDate <= today || isOverdue(w, now)))
    .sort(compareWorkItems);
  const tasks: WidgetTask[] = open.slice(0, WIDGET_MAX_TASKS).map((w) => ({
    title: w.title,
    subject: w.subjectId ? (subjects.get(w.subjectId)?.name ?? '') : '',
    overdue: isOverdue(w, now),
    due: w.dueTime ?? '',
  }));

  const horizon = addDaysIso(today, 14);
  const exams = data.exams
    .filter((e) => e.date >= today && e.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, WIDGET_MAX_EXAMS)
    .map((e) => {
      const c = countdown(e.date, today);
      return {
        title: e.title ?? texts.subjectName(e.subjectId),
        when:
          c.kind === 'inDays'
            ? texts.t('countdown.inDays', { count: c.days })
            : texts.t(`countdown.${c.kind}`),
      };
    });

  const upcomingExams = data.exams
    .filter((e) => e.date >= today && e.date <= addDaysIso(today, 60))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(0, 5)
    .map((e) => ({
      title: e.title ?? texts.subjectName(e.subjectId),
      subject: texts.subjectName(e.subjectId),
      when: examWhen(e.date, today, texts),
      date: `${texts.weekdayShort(isoWeekday(e.date))} ${fromIsoDate(e.date).getDate()}${e.time ? ` · ${e.time}` : ''}`,
    }));

  return {
    date: texts.formatDate(now),
    next,
    courses: courses.slice(0, WIDGET_MAX_COURSES),
    tasks,
    moreTasks: Math.max(0, open.length - tasks.length),
    exams,
    upcomingExams,
    study: buildStudy(data, texts),
    week: buildWeek(data, extras, now, texts),
    subjects: buildSubjects(data, subjects, now, texts, scheme),
    grades: buildGrades(data, subjects, texts, scheme),
    month: buildMonth(data, extras, now, texts),
    habits: buildHabits(data, today, scheme),
    links: WIDGET_LINKS,
    labels: {
      nextCourse: texts.t('widget.nextCourse'),
      noCourse: texts.t('widget.noCourse'),
      ongoing: texts.t('widget.ongoing'),
      startsIn: next ? startsIn(next, today, now, texts) : '',
      today: texts.t('widget.today'),
      tasks: texts.t('widget.tasks'),
      noTask: texts.t('widget.noTask'),
      overdue: texts.t('widget.overdue'),
      exams: texts.t('widget.exams'),
      cancelled: texts.t('widget.cancelled'),
      more: texts.t('widget.more', { count: Math.max(0, open.length - tasks.length) }),
      study: texts.t('widget.study'),
      studyRunning: texts.t('widget.studyRunning'),
      breakRunning: texts.t('widget.breakRunning'),
      studyIdle: texts.t('widget.studyIdle'),
      studyStart: texts.t('widget.studyStart'),
      untilTime: texts.t('widget.untilTime'),
      week: texts.t('widget.week'),
      weekTotal: texts.t('widget.weekTotal'),
      streak: texts.t('widget.streak'),
      subject: texts.t('widget.subject'),
      subjectPick: texts.t('widget.subjectPick'),
      subjectNone: texts.t('widget.subjectNone'),
      noExam: texts.t('widget.noExam'),
      quickNote: texts.t('widget.quickNote'),
      quickTask: texts.t('widget.quickTask'),
      quickAssignment: texts.t('widget.quickAssignment'),
      grades: texts.t('widget.grades'),
      noGrade: texts.t('widget.noGrade'),
      lastGrade: texts.t('widget.lastGrade'),
      overall: texts.t('widget.overall'),
      month: texts.t('widget.month'),
      habits: texts.t('widget.habits'),
      noHabit: texts.t('widget.noHabit'),
    },
    light: pickWidgetTheme(themes.light),
    dark: pickWidgetTheme(themes.dark),
    url: WIDGET_URL,
  };
}

export type WidgetTimelineEntry = { date: Date; props: WidgetData };

/**
 * Chronologie pour iOS : une entrée maintenant, puis une à chaque début et fin de séance
 * du jour et à minuit, pour que « Prochain cours » avance sans que l'app soit ouverte.
 */
export function buildWidgetTimeline(
  data: TodayData,
  subjects: ReadonlyMap<string, Subject>,
  now: Date,
  texts: WidgetTexts,
  themes: { light: ColorTokens; dark: ColorTokens },
  extras: WidgetExtras = EMPTY_EXTRAS,
): WidgetTimelineEntry[] {
  const today = toIsoDate(now);
  const moments = new Set<number>([now.getTime()]);
  for (const o of occurrencesInRange(data.series, today, today, data)) {
    for (const t of [o.startTime, o.endTime]) {
      const at = atTime(o.date, t).getTime() + 1000;
      if (at > now.getTime()) moments.add(at);
    }
  }
  const session = data.studySession;
  if (session && session.endedAt === null) {
    const end = plannedEnd(session).getTime() + 1000;
    if (end > now.getTime()) moments.add(end);
  }
  moments.add(atTime(addDaysIso(today, 1), '00:00').getTime() + 1000);
  return [...moments]
    .sort((a, b) => a - b)
    .slice(0, 12)
    .map((ms) => {
      const at = new Date(ms);
      return { date: at, props: buildWidgetData(data, subjects, at, texts, themes, extras) };
    });
}
