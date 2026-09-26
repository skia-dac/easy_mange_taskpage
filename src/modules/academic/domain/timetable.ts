import { z } from 'zod';

import { type IsoDate } from '@/shared/dates';
import { fieldLimits } from '@/shared/fieldLimits';
import { isoDate, requiredText } from '@/shared/validation';

/** Types d'emploi du temps : les cours, une session d'examens, un planning de révisions. */
export const timetableKinds = ['courses', 'exams', 'revision'] as const;
export type TimetableKind = (typeof timetableKinds)[number];

export const timetableInputSchema = z
  .object({
    name: requiredText(fieldLimits.name60.max),
    validFrom: isoDate,
    validUntil: isoDate,
    kind: z.enum(timetableKinds).default('courses'),
  })
  .refine((t) => t.validUntil >= t.validFrom, {
    error: 'validation.untilAfterFrom',
    path: ['validUntil'],
  });

export type TimetableInput = z.input<typeof timetableInputSchema>;
export type Timetable = z.output<typeof timetableInputSchema> & { id: string };

/** Emploi du temps applicable à une date (spécification §21), pour un type donné (cours par défaut). */
export function activeTimetable(
  timetables: readonly Timetable[],
  day: IsoDate,
  kind: TimetableKind = 'courses',
): Timetable | undefined {
  return timetables.find((t) => t.kind === kind && t.validFrom <= day && day <= t.validUntil);
}
