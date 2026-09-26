import { z } from 'zod';

import {
  addDaysIso,
  daysBetween,
  isoWeekday,
  startOfWeekOn,
  timeToMinutes,
  type IsoDate,
  type Time,
} from '@/shared/dates';
import { spaceSchema, type SpaceId } from '@/shared/spaces';
import { isoDate, optionalText, requiredText, time } from '@/shared/validation';

import type { PersonalEvent } from './personalEvent';

/**
 * Créneau fixe du planning (travail, sport, activité…) : il revient chaque semaine aux jours
 * choisis, ou une semaine sur deux (rotation A / B). Une fin avant le début = créneau de nuit
 * (il se termine le lendemain).
 */
export const slotRotations = ['every', 'A', 'B'] as const;
export type SlotRotation = (typeof slotRotations)[number];

export const slotInputSchema = z
  .object({
    title: requiredText(80),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1, { error: 'validation.pickDay' })
      .transform((d) => [...new Set(d)].sort()),
    startTime: time,
    endTime: time,
    location: optionalText(80),
    note: optionalText(500),
    rotation: z.enum(slotRotations).default('every'),
    validFrom: isoDate,
    validUntil: isoDate.nullish().transform((v) => v ?? null),
    colorId: z.string().min(1).default('blue'),
    space: spaceSchema.default('work'),
  })
  .superRefine((s, ctx) => {
    if (s.startTime === s.endTime)
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'validation.endAfterStart' });
    if (s.validUntil && s.validUntil < s.validFrom)
      ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'validation.untilAfterFrom' });
  });

export type SlotInput = z.input<typeof slotInputSchema>;
export type Slot = z.output<typeof slotInputSchema> & { id: string };

/** Créneau de nuit : il finit le lendemain (ex. 22:00 → 06:00). */
export function isOvernight(s: { startTime: Time; endTime: Time }): boolean {
  return timeToMinutes(s.endTime) < timeToMinutes(s.startTime);
}

export function slotMinutes(s: { startTime: Time; endTime: Time }): number {
  const d = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
  return d > 0 ? d : d + 24 * 60;
}

/**
 * Semaine A ou B. `anchor` = premier jour d'une semaine A (réglage « Cette semaine est… »).
 * Sans réglage, la semaine en cours est A.
 */
export function rotationOf(day: IsoDate, anchor: IsoDate, weekStart: number): 'A' | 'B' {
  const w = startOfWeekOn(day, weekStart);
  const a = startOfWeekOn(anchor, weekStart);
  const weeks = Math.round(daysBetween(a, w) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

/** Préfixe des identifiants des séances de créneaux (elles ne sont pas enregistrées). */
export const SLOT_EVENT_PREFIX = 'slot:';

export function isSlotEvent(e: Pick<PersonalEvent, 'id'>): boolean {
  return e.id.startsWith(SLOT_EVENT_PREFIX);
}

/** Id du créneau d'une séance (`slot:<id>:<date>`). */
export function slotIdOf(e: Pick<PersonalEvent, 'id'>): string {
  return e.id.slice(SLOT_EVENT_PREFIX.length).split(':')[0] ?? '';
}

/**
 * Les séances des créneaux entre `from` et `to`, sous forme d'événements (calculées, jamais
 * enregistrées) : elles apparaissent partout où les rendez-vous apparaissent. Une séance de nuit
 * est affichée le jour où elle commence, jusqu'à minuit.
 */
export function slotOccurrences(
  slots: readonly Slot[],
  from: IsoDate,
  to: IsoDate,
  anchor: IsoDate,
  weekStart: number,
): PersonalEvent[] {
  const out: PersonalEvent[] = [];
  for (let d = from; d <= to; d = addDaysIso(d, 1)) {
    const wd = isoWeekday(d);
    for (const s of slots) {
      if (!s.weekdays.includes(wd)) continue;
      if (d < s.validFrom || (s.validUntil && d > s.validUntil)) continue;
      if (s.rotation !== 'every' && rotationOf(d, anchor, weekStart) !== s.rotation) continue;
      out.push({
        id: `${SLOT_EVENT_PREFIX}${s.id}:${d}`,
        title: s.title,
        date: d,
        startTime: s.startTime,
        endTime: isOvernight(s) ? '23:59' : s.endTime,
        description: s.location,
        reminderAt: null,
        space: s.space,
      });
    }
  }
  return out;
}

/** Copies des rendez-vous d'une semaine vers la suivante (« Copier la semaine dernière »). */
export function copyWeekInputs(
  events: readonly PersonalEvent[],
  lastWeekFrom: IsoDate,
  space: SpaceId,
): {
  title: string;
  date: IsoDate;
  startTime: Time | null;
  endTime: Time | null;
  description: string | null;
  space: SpaceId;
}[] {
  const lastWeekTo = addDaysIso(lastWeekFrom, 6);
  const thisWeek = new Set(
    events
      .filter((e) => e.date > lastWeekTo && e.date <= addDaysIso(lastWeekTo, 7))
      .map((e) => `${e.date}|${e.startTime ?? ''}|${e.title}`),
  );
  return events
    .filter(
      (e) => !isSlotEvent(e) && e.space === space && e.date >= lastWeekFrom && e.date <= lastWeekTo,
    )
    .map((e) => ({
      title: e.title,
      date: addDaysIso(e.date, 7),
      startTime: e.startTime,
      endTime: e.endTime,
      description: e.description,
      space: e.space,
    }))
    .filter((e) => !thisWeek.has(`${e.date}|${e.startTime ?? ''}|${e.title}`));
}
