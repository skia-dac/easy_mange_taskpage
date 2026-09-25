import { z } from 'zod';

import { isoDate, requiredText } from '@/shared/validation';

/** Objectif d'épargne (un téléphone, les frais d'inscription…). */
export const goalInputSchema = z.object({
  name: requiredText(60),
  targetMinor: z
    .number({ error: 'money.invalidAmount' })
    .int({ error: 'money.invalidAmount' })
    .positive({ error: 'money.invalidAmount' }),
  currency: z.string().min(3).max(3),
  deadline: isoDate.nullish().transform((v) => v ?? null),
});
export type GoalInput = z.input<typeof goalInputSchema>;
export type Goal = z.output<typeof goalInputSchema> & { id: string; archived: boolean };
