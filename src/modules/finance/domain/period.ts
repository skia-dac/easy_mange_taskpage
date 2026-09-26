import { z } from 'zod';

import {
  addDaysIso,
  daysBetween,
  fromIsoDate,
  isoWeekday,
  toIsoDate,
  type IsoDate,
} from '@/shared/dates';

/**
 * Période de budget choisie par l'étudiant : un mois qui commence le jour de son choix
 * (le 1er, le 25…), ou une semaine qui commence le jour de son choix.
 */
export const budgetPeriodSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('month'), startDay: z.number().int().min(1).max(31) }),
  z.object({ kind: z.literal('week'), startWeekday: z.number().int().min(1).max(7) }),
]);
export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;
export const defaultBudgetPeriod: BudgetPeriod = { kind: 'month', startDay: 1 };

export type PeriodRange = { from: IsoDate; to: IsoDate };

/** Le jour `day` du mois (année, mois 0–11), ramené au dernier jour si le mois est plus court. */
function dayInMonth(year: number, month: number, day: number): IsoDate {
  const last = new Date(year, month + 1, 0).getDate();
  return toIsoDate(new Date(year, month, Math.min(day, last)));
}

/** La période qui contient `date`. */
export function periodContaining(date: IsoDate, p: BudgetPeriod): PeriodRange {
  if (p.kind === 'week') {
    const from = addDaysIso(date, -((isoWeekday(date) - p.startWeekday + 7) % 7));
    return { from, to: addDaysIso(from, 6) };
  }
  const d = fromIsoDate(date);
  let y = d.getFullYear();
  let m = d.getMonth();
  if (date < dayInMonth(y, m, p.startDay)) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  const from = dayInMonth(y, m, p.startDay);
  const nextStart = dayInMonth(m === 11 ? y + 1 : y, (m + 1) % 12, p.startDay);
  return { from, to: addDaysIso(nextStart, -1) };
}

/** Période précédente (−1) ou suivante (+1). */
export function shiftPeriod(range: PeriodRange, p: BudgetPeriod, dir: -1 | 1): PeriodRange {
  return periodContaining(dir === 1 ? addDaysIso(range.to, 1) : addDaysIso(range.from, -1), p);
}

/** Jours restants dans la période, aujourd'hui compris (au moins 1). */
export function daysLeft(range: PeriodRange, today: IsoDate): number {
  if (today > range.to) return 1;
  const start = today < range.from ? range.from : today;
  return daysBetween(start, range.to) + 1;
}
