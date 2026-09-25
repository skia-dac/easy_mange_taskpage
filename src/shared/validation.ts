import { z } from 'zod';

import { isIsoDate, isTime } from './dates';
import { AppError } from './errors';

/**
 * Règles de validation communes. Les messages sont des clés de traduction (validation.*),
 * affichées sous le champ concerné.
 */
export const requiredText = (max = 120) =>
  z
    .string({ error: 'validation.required' })
    .trim()
    .min(1, { error: 'validation.required' })
    .max(max, { error: 'validation.tooLong' });

export const optionalText = (max = 120) =>
  z
    .string()
    .nullish()
    .transform((v) => {
      const t = (v ?? '').trim();
      return t === '' ? null : t;
    })
    .refine((v) => v === null || v.length <= max, { error: 'validation.tooLong' });

export const requiredId = (error = 'validation.required') => z.string({ error }).min(1, { error });

export const optionalId = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null));

export const isoDate = z
  .string({ error: 'validation.invalidDate' })
  .refine(isIsoDate, { error: 'validation.invalidDate' });

export const time = z
  .string({ error: 'validation.invalidTime' })
  .refine(isTime, { error: 'validation.invalidTime' });

export const optionalTime = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isTime(v), { error: 'validation.invalidTime' });

/** Champ → clé de traduction de l'erreur. */
export type FieldErrors = Record<string, string>;

export class ValidationError extends AppError {
  readonly fields: FieldErrors;

  constructor(fields: FieldErrors) {
    super('validation', Object.keys(fields).join(', '));
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

const MESSAGE_PREFIXES = ['validation.', 'money.', 'auth.'];

/** Un message zod par défaut (technique, en anglais) devient « Valeur non valide ». */
function userMessage(message: string): string {
  return MESSAGE_PREFIXES.some((p) => message.startsWith(p)) ? message : 'validation.invalid';
}

/** Valide une saisie ; lève ValidationError (avec l'erreur de chaque champ) si elle est incorrecte. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_form');
    fields[key] ??= userMessage(issue.message);
  }
  throw new ValidationError(fields);
}
