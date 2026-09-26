import { dayState, logOn, type Habit, type HabitLog } from '@/modules/productivity';
import { addDaysIso, startOfWeekOn, type IsoDate } from '@/shared/dates';

/**
 * Grille de progression façon GitHub : une case par jour, de 0 (rien) à 4 (objectif atteint).
 * `null` = jour sans objectif (pas prévu, excusé), pas encore arrivé, ou aujourd'hui pas encore fait.
 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4;
export type HeatCell = {
  date: IsoDate;
  level: HeatLevel | null;
  /** Jour à venir (case vide, contour seulement). */
  future: boolean;
  /** Hors de la période montrée (vue Mois : jours du mois d'avant / d'après). */
  outside: boolean;
};
export type ProgressScope = 'week' | 'month' | 'year';
export const progressScopes: readonly ProgressScope[] = ['week', 'month', 'year'];

/** Nombre de semaines de la vue Année (comme GitHub). */
export const YEAR_WEEKS = 53;

/** Niveau d'une habitude un jour donné. */
export function habitLevel(
  habit: Habit,
  logs: readonly HabitLog[],
  day: IsoDate,
  today: IsoDate,
): HeatLevel | null {
  if (day > today) return null;
  const state = dayState(habit, logs, day, today);
  switch (state) {
    case 'done':
      return 4;
    case 'partial': {
      const log = logOn(logs, habit.id, day);
      const ratio = habit.target > 0 ? (log?.count ?? 0) / habit.target : 0;
      return ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1;
    }
    case 'missed':
      return 0;
    case 'pending':
      // Aujourd'hui pas encore fait : case vide (contour), ni raté ni compté dans le total.
      return null;
    default:
      return null;
  }
}

/** Niveau de toutes les habitudes ensemble : part des habitudes prévues qui sont réussies. */
export function overallLevel(
  habits: readonly Habit[],
  logs: readonly HabitLog[],
  day: IsoDate,
  today: IsoDate,
): HeatLevel | null {
  let expected = 0;
  let score = 0;
  for (const h of habits) {
    const l = habitLevel(h, logs, day, today);
    if (l === null) continue;
    expected++;
    score += l / 4;
  }
  if (expected === 0) return null;
  const ratio = score / expected;
  if (ratio >= 1) return 4;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return ratio > 0 ? 1 : 0;
}

/**
 * Les semaines à dessiner (chaque semaine = 7 cases, du premier jour de la semaine choisi).
 * Semaine : la semaine en cours · Mois : les semaines du mois · Année : les 53 dernières semaines.
 */
export function heatWeeks(
  scope: ProgressScope,
  today: IsoDate,
  weekStart: number,
  levelOf: (day: IsoDate) => HeatLevel | null,
): HeatCell[][] {
  const thisWeek = startOfWeekOn(today, weekStart);
  let first: IsoDate;
  let count: number;
  let inRange: (d: IsoDate) => boolean = () => true;
  if (scope === 'week') {
    first = thisWeek;
    count = 1;
  } else if (scope === 'year') {
    first = addDaysIso(thisWeek, -7 * (YEAR_WEEKS - 1));
    count = YEAR_WEEKS;
  } else {
    const monthStart = `${today.slice(0, 8)}01`;
    first = startOfWeekOn(monthStart, weekStart);
    const month = today.slice(0, 7);
    inRange = (d) => d.slice(0, 7) === month;
    count = 0;
    for (let w = first; w.slice(0, 7) <= month; w = addDaysIso(w, 7)) count++;
  }
  const weeks: HeatCell[][] = [];
  for (let w = 0; w < count; w++) {
    const week: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDaysIso(first, w * 7 + i);
      const outside = !inRange(date);
      week.push({
        date,
        level: outside ? null : levelOf(date),
        future: date > today,
        outside,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export type ProgressStats = {
  /** Jours où l'objectif est atteint. */
  doneDays: number;
  /** Jours où quelque chose a été fait (même partiellement). */
  activeDays: number;
  /** Jours prévus passés (base du pourcentage). */
  expectedDays: number;
  /** Plus longue suite de jours réussis dans la période. */
  bestRun: number;
};

export function progressStats(weeks: readonly HeatCell[][]): ProgressStats {
  let doneDays = 0;
  let activeDays = 0;
  let expectedDays = 0;
  let run = 0;
  let bestRun = 0;
  for (const c of weeks.flat()) {
    if (c.outside || c.future || c.level === null) continue;
    expectedDays++;
    if (c.level > 0) activeDays++;
    if (c.level === 4) {
      doneDays++;
      run++;
      bestRun = Math.max(bestRun, run);
    } else run = 0;
  }
  return { doneDays, activeDays, expectedDays, bestRun };
}
