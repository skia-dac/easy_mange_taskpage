import { z } from 'zod';

import { daysBetween, type IsoDate } from '@/shared/dates';
import {
  isoDate,
  optionalId,
  optionalText,
  optionalTime,
  requiredId,
  time,
} from '@/shared/validation';

/** Règle 6 : un examen a obligatoirement une matière et une date. */
export const examInputSchema = z.object({
  subjectId: requiredId('validation.subjectRequired'),
  title: optionalText(80),
  date: isoDate,
  time: optionalTime,
  durationMinutes: z
    .number({ error: 'validation.invalidDuration' })
    .int({ error: 'validation.invalidDuration' })
    .min(1, { error: 'validation.invalidDuration' })
    .max(24 * 60, { error: 'validation.invalidDuration' })
    .nullish()
    .transform((v) => v ?? null),
  room: optionalText(40),
  description: optionalText(1000),
  /** Jours avant l'examen où envoyer un rappel (§74), ex. [7, 1]. */
  reminderDays: z.array(z.number().int().min(0).max(60)).default([]),
  reminderTime: time.default('09:00'),
  /** Note obtenue (null tant que l'examen n'est pas corrigé). */
  grade: z
    .number({ error: 'validation.invalidGrade' })
    .min(0, { error: 'validation.invalidGrade' })
    .max(10_000, { error: 'validation.invalidGrade' })
    .nullish()
    .transform((v) => v ?? null),
  /** Barème (20 par défaut). */
  gradeMax: z
    .number({ error: 'validation.invalidGrade' })
    .positive({ error: 'validation.invalidGrade' })
    .max(10_000, { error: 'validation.invalidGrade' })
    .default(20),
  /** Coefficient dans la moyenne de la matière. */
  coefficient: z
    .number({ error: 'validation.invalidCoefficient' })
    .positive({ error: 'validation.invalidCoefficient' })
    .max(100, { error: 'validation.invalidCoefficient' })
    .default(1),
  /** Session d'examens (emploi du temps de type « examens »), facultative. */
  timetableId: optionalId,
});

/** Zod ne permet pas de comparer deux champs dans `object()` : vérification séparée. */
export const examSchema = examInputSchema.superRefine((e, ctx) => {
  if (e.grade !== null && e.grade > e.gradeMax)
    ctx.addIssue({ code: 'custom', path: ['grade'], message: 'validation.gradeTooHigh' });
});

export const examReminderOptions = [7, 3, 1] as const;

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
