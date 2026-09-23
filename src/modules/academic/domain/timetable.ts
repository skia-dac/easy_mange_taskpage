import { z } from 'zod';

import { type IsoDate } from '@/shared/dates';
import { isoDate, requiredText } from '@/shared/validation';

export const timetableInputSchema = z
  .object({ name: requiredText(60), validFrom: isoDate, validUntil: isoDate })
  .refine((t) => t.validUntil >= t.validFrom, {
    error: 'validation.untilAfterFrom',
    path: ['validUntil'],
  });

export type TimetableInput = z.input<typeof timetableInputSchema>;
export type Timetable = z.output<typeof timetableInputSchema> & { id: string };

/** Emploi du temps applicable à une date (spécification §21). */
export function activeTimetable(
  timetables: readonly Timetable[],
  day: IsoDate,
): Timetable | undefined {
  return timetables.find((t) => t.validFrom <= day && day <= t.validUntil);
}
