import { z } from 'zod';

import { isoDate, optionalId, optionalText } from '@/shared/validation';

/**
 * Une opération d'argent, notée par l'étudiant :
 * - expense / income : dépense, entrée ;
 * - saving / saving_back : mis de côté pour un objectif, repris de l'épargne ;
 * - lend / lend_back : argent prêté à quelqu'un, puis rendu ;
 * - borrow / borrow_back : argent emprunté, puis remboursé.
 */
export const transactionKinds = [
  'expense',
  'income',
  'saving',
  'saving_back',
  'lend',
  'lend_back',
  'borrow',
  'borrow_back',
] as const;
export type TransactionKind = (typeof transactionKinds)[number];

/** L'argent entre dans la poche (+) ou en sort (−). */
const inflows: ReadonlySet<TransactionKind> = new Set([
  'income',
  'saving_back',
  'lend_back',
  'borrow',
]);
export const isInflow = (kind: TransactionKind) => inflows.has(kind);
export const signedAmount = (t: Pick<Transaction, 'kind' | 'amountMinor'>) =>
  isInflow(t.kind) ? t.amountMinor : -t.amountMinor;

export const transactionInputSchema = z.object({
  kind: z.enum(transactionKinds),
  amountMinor: z
    .number({ error: 'money.invalidAmount' })
    .int({ error: 'money.invalidAmount' })
    .positive({ error: 'money.invalidAmount' })
    .max(1_000_000_000_000, { error: 'money.invalidAmount' }),
  currency: z.string().min(3).max(3),
  categoryId: optionalId,
  date: isoDate,
  note: optionalText(120),
  recurringId: optionalId,
  occurrenceDate: isoDate.nullish().transform((v) => v ?? null),
  goalId: optionalId,
  loanId: optionalId,
});

export type TransactionInput = z.input<typeof transactionInputSchema>;
export type Transaction = z.output<typeof transactionInputSchema> & { id: string };
