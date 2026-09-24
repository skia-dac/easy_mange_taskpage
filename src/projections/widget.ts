import { occurrencesInRange, type Occurrence, type Subject } from '@/modules/academic';
import { compareWorkItems, isOverdue } from '@/modules/productivity';
import { addDaysIso, atTime, toIsoDate } from '@/shared/dates';
import type { ColorTokens } from '@/shared/theme';

import { countdown } from '@/modules/academic';

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
  labels: WidgetLabels;
  light: WidgetTheme;
  dark: WidgetTheme;
  /** Lien ouvert quand on touche le widget. */
  url: string;
};

export const WIDGET_URL = 'mysky://';
export const WIDGET_MAX_COURSES = 5;
export const WIDGET_MAX_TASKS = 5;
export const WIDGET_MAX_EXAMS = 3;

export type WidgetTexts = {
  /** Traduction d'une clé de `widget.*` (et `countdown.*`). */
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (d: Date) => string;
  subjectName: (id: string) => string;
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

export function buildWidgetData(
  data: TodayData,
  subjects: ReadonlyMap<string, Subject>,
  now: Date,
  texts: WidgetTexts,
  themes: { light: ColorTokens; dark: ColorTokens },
): WidgetData {
  const today = toIsoDate(now);
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

  return {
    date: texts.formatDate(now),
    next,
    courses: courses.slice(0, WIDGET_MAX_COURSES),
    tasks,
    moreTasks: Math.max(0, open.length - tasks.length),
    exams,
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
): WidgetTimelineEntry[] {
  const today = toIsoDate(now);
  const moments = new Set<number>([now.getTime()]);
  for (const o of occurrencesInRange(data.series, today, today, data)) {
    for (const t of [o.startTime, o.endTime]) {
      const at = atTime(o.date, t).getTime() + 1000;
      if (at > now.getTime()) moments.add(at);
    }
  }
  moments.add(atTime(addDaysIso(today, 1), '00:00').getTime() + 1000);
  return [...moments]
    .sort((a, b) => a - b)
    .slice(0, 12)
    .map((ms) => {
      const at = new Date(ms);
      return { date: at, props: buildWidgetData(data, subjects, at, texts, themes) };
    });
}
