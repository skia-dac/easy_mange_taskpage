import { z } from 'zod';

import { daysBetween, type IsoDate } from '@/shared/dates';
import { isoDate, optionalText, optionalTime, requiredId } from '@/shared/validation';

/** Règle 6 : un examen a obligatoirement une matière et une date. */
export const examInputSchema = z.object({
  subjectId: requiredId('validation.subjectRequired'),
  title: optionalText(80),
  date: isoDate,
  time: optionalTime,
  durationMinutes: z
    .number()
    .int()
    .min(1, { error: 'validation.invalidDuration' })
    .max(24 * 60, { error: 'validation.invalidDuration' })
    .nullish()
    .transform((v) => v ?? null),
  room: optionalText(40),
  description: optionalText(1000),
});

export type ExamInput = z.input<typeof examInputSchema>;
export type Exam = z.output<typeof examInputSchema> & { id: string };

export type Countdown =
  { kind: 'past' } | { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'inDays'; days: number };

/** « Aujourd'hui », « Demain », « Dans X jours » (spécification §68). */
export function countdown(date: IsoDate, today: IsoDate): Countdown {
  const days = daysBetween(today, date);
  if (days < 0) return { kind: 'past' };
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  return { kind: 'inDays', days };
}
