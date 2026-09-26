import { z } from 'zod';

import { fieldLimits } from '@/shared/fieldLimits';
import { isoDate, optionalText, requiredText } from '@/shared/validation';

/** « On me doit » (argent prêté) ou « je dois » (argent emprunté). */
export const loanDirections = ['lent', 'borrowed'] as const;
export type LoanDirection = (typeof loanDirections)[number];

export const loanInputSchema = z.object({
  direction: z.enum(loanDirections),
  person: requiredText(fieldLimits.person.max),
  dueDate: isoDate.nullish().transform((v) => v ?? null),
  note: optionalText(fieldLimits.note200.max),
});
export type LoanInput = z.input<typeof loanInputSchema>;
export type Loan = z.output<typeof loanInputSchema> & { id: string; closed: boolean };
