import { z } from 'zod';

import { addDaysIso, fromIsoDate, isoWeekday, toIsoDate, type IsoDate } from '@/shared/dates';
import { isoDate, optionalId, optionalText, optionalTime, requiredText } from '@/shared/validation';

/**
 * Ce qui revient : une charge fixe (loyer, eau, électricité, internet…) ou une tontine / njangi
 * (cotisation régulière, et le jour où c'est ton tour de recevoir la cagnotte).
 */
export const recurringKinds = ['charge', 'tontine'] as const;
export type RecurringKind = (typeof recurringKinds)[number];
export const frequencies = ['monthly', 'weekly'] as const;
export type Frequency = (typeof frequencies)[number];

/** Rappels proposés, en minutes avant : 10 min, 1 h, 3 h, la veille, 2 jours, 3 jours. */
export const reminderChoices = [10, 60, 180, 1440, 2880, 4320] as const;
export const MAX_REMINDERS = 3;

const amount = z
  .number({ error: 'money.invalidAmount' })
  .int({ error: 'money.invalidAmount' })
  .positive({ error: 'money.invalidAmount' })
  .max(1_000_000_000_000, { error: 'money.invalidAmount' });

export const recurringInputSchema = z
  .object({
    kind: z.enum(recurringKinds),
    name: requiredText(60),
    categoryId: optionalId,
    amountMinor: amount,
    currency: z.string().min(3).max(3),
    frequency: z.enum(frequencies),
    /** Mensuel : le jour du mois (31 = le dernier jour des mois plus courts). */
    dayOfMonth: z.number().int().min(1).max(31).default(1),
    /** Hebdomadaire : 1 = lundi … 7 = dimanche. */
    weekday: z.number().int().min(1).max(7).default(6),
    time: optionalTime,
    reminders: z
      .array(z.number().int().min(1).max(10080))
      .max(MAX_REMINDERS, { error: 'money.tooManyReminders' })
      .default([]),
    startDate: isoDate,
    endDate: isoDate.nullish().transform((v) => v ?? null),
    active: z.boolean().default(true),
    /** Tontine : le jour où c'est ton tour, et ce que tu reçois. */
    payoutDate: isoDate.nullish().transform((v) => v ?? null),
    payoutMinor: amount.nullish().transform((v) => v ?? null),
    /** Le tour compte tout seul comme une entrée d'argent le jour venu (modifiable). */
    payoutAuto: z.boolean().default(true),
    note: optionalText(200),
  })
  .superRefine((r, ctx) => {
    if (r.endDate && r.endDate < r.startDate)
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'validation.untilAfterFrom' });
    if (r.payoutDate && !r.payoutMinor)
      ctx.addIssue({ code: 'custom', path: ['payoutMinor'], message: 'money.invalidAmount' });
  });

export type RecurringInput = z.input<typeof recurringInputSchema>;
export type Recurring = z.output<typeof recurringInputSchema> & {
  id: string;
  /** Le tour de tontine a déjà été ajouté aux entrées. */
  payoutRecorded: boolean;
};

function dayOfMonthIn(year: number, month: number, day: number): IsoDate {
  const last = new Date(year, month + 1, 0).getDate();
  return toIsoDate(new Date(year, month, Math.min(day, last)));
}

/** Les dates où la charge ou la cotisation tombe entre `from` et `to` (inclus). */
export function occurrencesBetween(
  r: Pick<Recurring, 'frequency' | 'dayOfMonth' | 'weekday' | 'startDate' | 'endDate' | 'active'>,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  if (!r.active) return [];
  const start = r.startDate > from ? r.startDate : from;
  const end = r.endDate && r.endDate < to ? r.endDate : to;
  if (start > end) return [];
  const out: IsoDate[] = [];
  if (r.frequency === 'weekly') {
    for (
      let d = addDaysIso(start, (r.weekday - isoWeekday(start) + 7) % 7);
      d <= end;
      d = addDaysIso(d, 7)
    )
      out.push(d);
    return out;
  }
  const s = fromIsoDate(start);
  for (let y = s.getFullYear(), m = s.getMonth(); ; m++) {
    if (m > 11) {
      m = 0;
      y++;
    }
    const d = dayOfMonthIn(y, m, r.dayOfMonth);
    if (d > end) break;
    if (d >= start) out.push(d);
  }
  return out;
}

export type DueItem = {
  recurring: Recurring;
  date: IsoDate;
  amountMinor: number;
  paid: boolean;
  /** Id de l'opération qui a payé cette échéance. */
  transactionId: string | null;
};

/** Échéances d'une période, avec « payé » si une opération y est rattachée. */
export function dueItems(
  recurring: readonly Recurring[],
  payments: readonly {
    id: string;
    recurringId: string | null;
    occurrenceDate: string | null;
    kind: string;
  }[],
  from: IsoDate,
  to: IsoDate,
): DueItem[] {
  const paid = new Map<string, string>();
  for (const p of payments)
    if (p.recurringId && p.occurrenceDate && p.kind === 'expense')
      paid.set(`${p.recurringId}|${p.occurrenceDate}`, p.id);
  const out: DueItem[] = [];
  for (const r of recurring) {
    for (const date of occurrencesBetween(r, from, to)) {
      const id = paid.get(`${r.id}|${date}`) ?? null;
      out.push({
        recurring: r,
        date,
        amountMinor: r.amountMinor,
        paid: id !== null,
        transactionId: id,
      });
    }
  }
  return out.sort(
    (a, b) => a.date.localeCompare(b.date) || a.recurring.name.localeCompare(b.recurring.name),
  );
}
