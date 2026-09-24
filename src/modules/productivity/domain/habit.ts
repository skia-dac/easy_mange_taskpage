import { z } from 'zod';

import { addDaysIso, isoWeekday, startOfWeekOn, type IsoDate } from '@/shared/dates';
import { optionalText, optionalTime, requiredText } from '@/shared/validation';

/** Fréquence d'une habitude : tous les jours, certains jours de la semaine, ou N fois par semaine. */
export const habitFrequencies = ['daily', 'weekdays', 'weekly'] as const;
export type HabitFrequency = (typeof habitFrequencies)[number];

/** Icônes proposées (Feather). */
export const habitIcons = [
  'check-circle',
  'book-open',
  'activity',
  'droplet',
  'moon',
  'sun',
  'coffee',
  'heart',
  'music',
  'edit-3',
  'map-pin',
  'smartphone',
] as const;

/** Raisons rapides quand une habitude n'est pas respectée (facultatives). */
export const missReasons = ['tired', 'noTime', 'forgot', 'sick', 'other'] as const;
export type MissReason = (typeof missReasons)[number];

/** Statut d'un jour : fait, pas fait (avec raison facultative), excusé (ne casse pas la série). */
export const habitLogStatuses = ['done', 'missed', 'excused'] as const;
export type HabitLogStatus = (typeof habitLogStatuses)[number];

export const habitInputSchema = z
  .object({
    name: requiredText(60),
    icon: z.string().min(1).default('check-circle'),
    colorId: z.string().min(1).default('blue'),
    frequency: z.enum(habitFrequencies).default('daily'),
    /** Jours ISO (1 = lundi … 7 = dimanche), pour `weekdays`. */
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
    /** Pour `weekly` : nombre de fois par semaine. */
    timesPerWeek: z.number().int().min(1, { error: 'validation.invalidCount' }).max(7).default(1),
    /** Objectif chiffré par jour (8 verres d'eau). 1 = simple case à cocher. */
    target: z.number().int().min(1, { error: 'validation.invalidCount' }).max(50).default(1),
    unit: optionalText(20),
    reminderTime: optionalTime,
    /** Une session de révision terminée coche cette habitude. */
    autoStudy: z.boolean().default(false),
  })
  .superRefine((h, ctx) => {
    if (h.frequency === 'weekdays' && h.weekdays.length === 0)
      ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'validation.pickDays' });
  });

export type HabitInput = z.input<typeof habitInputSchema>;
export type Habit = z.output<typeof habitInputSchema> & { id: string; position: number };

export type HabitLog = {
  id: string;
  habitId: string;
  date: IsoDate;
  count: number;
  status: HabitLogStatus;
  reasonCode: MissReason | null;
  reason: string | null;
};

/** Habitudes proposées au premier affichage (l'étudiant garde celles qu'il veut). */
export const habitSuggestions: readonly (HabitInput & { key: string })[] = [
  {
    key: 'school',
    name: '',
    icon: 'map-pin',
    colorId: 'blue',
    frequency: 'weekdays',
    weekdays: [1, 2, 3, 4, 5],
  },
  {
    key: 'study',
    name: '',
    icon: 'book-open',
    colorId: 'violet',
    frequency: 'daily',
    autoStudy: true,
  },
  {
    key: 'sport',
    name: '',
    icon: 'activity',
    colorId: 'green',
    frequency: 'weekly',
    timesPerWeek: 3,
  },
  { key: 'water', name: '', icon: 'droplet', colorId: 'teal', frequency: 'daily', target: 8 },
  { key: 'sleep', name: '', icon: 'moon', colorId: 'slate', frequency: 'daily' },
];

/** L'habitude est-elle prévue ce jour-là ? (N fois / semaine : prévue tous les jours tant que l'objectif n'est pas atteint.) */
export function isScheduledOn(habit: Pick<Habit, 'frequency' | 'weekdays'>, day: IsoDate): boolean {
  if (habit.frequency === 'weekdays') return habit.weekdays.includes(isoWeekday(day));
  return true;
}

export function logOn(
  logs: readonly HabitLog[],
  habitId: string,
  day: IsoDate,
): HabitLog | undefined {
  return logs.find((l) => l.habitId === habitId && l.date === day);
}

/** Un jour est « réussi » quand l'objectif chiffré est atteint (ou la case cochée). */
export function isDone(habit: Pick<Habit, 'target'>, log: HabitLog | undefined): boolean {
  return !!log && log.status === 'done' && log.count >= habit.target;
}

export type DayState = 'done' | 'partial' | 'missed' | 'excused' | 'pending' | 'off';

/**
 * État d'un jour pour une habitude. `pending` = prévu, rien de noté (aujourd'hui ou futur),
 * `missed` = prévu, jour passé et pas fait (ou noté « pas fait »), `off` = pas prévu.
 */
export function dayState(
  habit: Habit,
  logs: readonly HabitLog[],
  day: IsoDate,
  today: IsoDate,
): DayState {
  const log = logOn(logs, habit.id, day);
  if (log?.status === 'excused') return 'excused';
  if (isDone(habit, log)) return 'done';
  if (log?.status === 'missed') return 'missed';
  if (habit.frequency === 'weekly') {
    if (log && log.count > 0) return 'partial';
    return day < today ? 'off' : 'pending';
  }
  if (!isScheduledOn(habit, day)) return 'off';
  if (log && log.count > 0) return 'partial';
  return day < today ? 'missed' : 'pending';
}

/** Nombre de jours réussis dans la semaine commençant `weekFrom`. */
export function doneInWeek(habit: Habit, logs: readonly HabitLog[], weekFrom: IsoDate): number {
  let n = 0;
  for (let i = 0; i < 7; i++)
    if (isDone(habit, logOn(logs, habit.id, addDaysIso(weekFrom, i)))) n++;
  return n;
}

/** Nombre de réussites attendues sur une semaine complète. */
export function expectedPerWeek(habit: Habit): number {
  if (habit.frequency === 'daily') return 7;
  if (habit.frequency === 'weekdays') return habit.weekdays.length;
  return habit.timesPerWeek;
}

/**
 * Série : jours prévus réussis d'affilée (jours excusés et non prévus ignorés).
 * Pour « N fois / semaine », la série compte les semaines où l'objectif est atteint.
 * Aujourd'hui ne casse pas la série tant qu'il n'est pas fini.
 */
export function streak(
  habit: Habit,
  logs: readonly HabitLog[],
  today: IsoDate,
  weekStart = 1,
): number {
  if (habit.frequency === 'weekly') {
    let n = 0;
    let week = startOfWeekOn(today, weekStart);
    if (doneInWeek(habit, logs, week) < habit.timesPerWeek) week = addDaysIso(week, -7);
    for (let i = 0; i < 520; i++) {
      if (doneInWeek(habit, logs, week) < habit.timesPerWeek) break;
      n++;
      week = addDaysIso(week, -7);
    }
    return n;
  }
  const mine = logs.filter((l) => l.habitId === habit.id);
  if (mine.length === 0) return 0;
  const earliest = mine.reduce((min, l) => (l.date < min ? l.date : min), today);
  let n = 0;
  for (let day = today; day >= earliest; day = addDaysIso(day, -1)) {
    const state = dayState(habit, logs, day, today);
    if (state === 'done') n++;
    else if (state === 'missed') break;
    else if ((state === 'pending' || state === 'partial') && day !== today) break;
  }
  return n;
}

/** Taux de réussite (0–1) sur une période, jours prévus uniquement (excusés retirés). */
export function completionRate(
  habit: Habit,
  logs: readonly HabitLog[],
  from: IsoDate,
  to: IsoDate,
  today: IsoDate,
  weekStart = 1,
): number | null {
  const end = to < today ? to : today;
  if (end < from) return null;
  if (habit.frequency === 'weekly') {
    let expected = 0;
    let done = 0;
    for (let w = startOfWeekOn(from, weekStart); w <= end; w = addDaysIso(w, 7)) {
      expected += habit.timesPerWeek;
      done += Math.min(habit.timesPerWeek, doneInWeek(habit, logs, w));
    }
    return expected > 0 ? done / expected : null;
  }
  let expected = 0;
  let done = 0;
  for (let d = from; d <= end; d = addDaysIso(d, 1)) {
    const state = dayState(habit, logs, d, today);
    if (state === 'off' || state === 'excused') continue;
    if (d === today && state !== 'done') continue;
    expected++;
    if (state === 'done') done++;
  }
  return expected > 0 ? done / expected : null;
}

export type HabitReview = {
  habitId: string;
  name: string;
  done: number;
  expected: number;
  respected: boolean;
  /** Jours manqués avec leur raison (si notée). */
  misses: { date: IsoDate; reasonCode: MissReason | null; reason: string | null }[];
};

/** Bilan d'une semaine : ce qui a été respecté ou non, et pourquoi. */
export function weeklyReview(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  weekFrom: IsoDate,
  today: IsoDate,
): HabitReview[] {
  return habits.map((h) => {
    const misses: HabitReview['misses'] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDaysIso(weekFrom, i);
      if (d > today) break;
      const state = dayState(h, logs, d, today);
      const log = logOn(logs, h.id, d);
      if (state === 'missed' || (log?.status === 'missed' && h.frequency === 'weekly'))
        misses.push({ date: d, reasonCode: log?.reasonCode ?? null, reason: log?.reason ?? null });
    }
    const done = doneInWeek(h, logs, weekFrom);
    const expected = expectedPerWeek(h);
    return { habitId: h.id, name: h.name, done, expected, respected: done >= expected, misses };
  });
}

/** Raisons les plus fréquentes sur une liste de jours manqués. */
export function topReasons(reviews: readonly HabitReview[]): { code: MissReason; count: number }[] {
  const counts = new Map<MissReason, number>();
  for (const r of reviews)
    for (const m of r.misses)
      if (m.reasonCode) counts.set(m.reasonCode, (counts.get(m.reasonCode) ?? 0) + 1);
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
}
