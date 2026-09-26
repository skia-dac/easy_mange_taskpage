import type { IsoDate } from '@/shared/dates';
import { write, type Db, type EntityWriter, type Values } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { parseInput } from '@/shared/validation';

import {
  categoryInputSchema,
  TONTINE_EXPENSE,
  TONTINE_INCOME,
  type CategoryInput,
} from '../domain/category';
import { goalInputSchema, type GoalInput } from '../domain/goal';
import { loanInputSchema, type LoanInput } from '../domain/loan';
import { recurringInputSchema, type RecurringInput } from '../domain/recurring';
import { transactionInputSchema, type TransactionInput } from '../domain/transaction';
import { toRecurring, type RecurringRow } from './rows';

const ALIVE = 'deleted_at IS NULL';

// ---- Opérations ----
function transactionValues(input: TransactionInput): Values {
  const v = parseInput(transactionInputSchema, input);
  return {
    kind: v.kind,
    amount_minor: v.amountMinor,
    currency: v.currency,
    category_id: v.categoryId,
    date: v.date,
    note: v.note,
    recurring_id: v.recurringId,
    occurrence_date: v.occurrenceDate,
    goal_id: v.goalId,
    loan_id: v.loanId,
  };
}

export async function createTransaction(db: Db, input: TransactionInput): Promise<string> {
  const values = transactionValues(input);
  return write(db, (w) => w.insert('money_transactions', values));
}

export async function updateTransaction(db: Db, id: string, input: TransactionInput) {
  const values = transactionValues(input);
  return write(db, (w) => w.update('money_transactions', id, values));
}

export async function deleteTransaction(db: Db, id: string) {
  return write(db, (w) => w.softDelete('money_transactions', id));
}

// ---- Catégories personnelles ----
export async function createCategory(db: Db, input: CategoryInput): Promise<string> {
  const v = parseInput(categoryInputSchema, input);
  return write(db, async (w) => {
    const last = await w.db.getFirstAsync<{ p: number | null }>(
      `SELECT MAX(position) AS p FROM money_categories WHERE ${ALIVE}`,
      [],
    );
    return w.insert('money_categories', {
      kind: v.kind,
      name: v.name,
      icon: v.icon,
      color_id: v.colorId,
      position: (last?.p ?? -1) + 1,
      archived: 0,
    });
  });
}

export async function updateCategory(db: Db, id: string, input: CategoryInput) {
  const v = parseInput(categoryInputSchema, input);
  return write(db, (w) =>
    w.update('money_categories', id, { name: v.name, icon: v.icon, color_id: v.colorId }),
  );
}

/** Supprimer une catégorie : ses opérations restent, rangées dans « Autre ». */
export async function deleteCategory(db: Db, id: string) {
  return write(db, async (w) => {
    const row = await w.db.getFirstAsync<{ kind: string }>(
      'SELECT kind FROM money_categories WHERE id = ?',
      [id],
    );
    const other = row?.kind === 'income' ? 'other_in' : 'other';
    for (const table of ['money_transactions', 'money_recurring'] as const) {
      const used = await w.db.getAllAsync<{ id: string }>(
        `SELECT id FROM ${table} WHERE ${ALIVE} AND category_id = ?`,
        [id],
      );
      for (const u of used) await w.update(table, u.id, { category_id: other });
    }
    await w.softDelete('money_categories', id);
  });
}

// ---- Charges fixes et tontines ----
function recurringValues(input: RecurringInput): Values {
  const v = parseInput(recurringInputSchema, input);
  return {
    kind: v.kind,
    name: v.name,
    category_id: v.categoryId ?? (v.kind === 'tontine' ? TONTINE_EXPENSE : null),
    amount_minor: v.amountMinor,
    currency: v.currency,
    frequency: v.frequency,
    day_of_month: v.dayOfMonth,
    weekday: v.weekday,
    time: v.time,
    reminders: JSON.stringify([...new Set(v.reminders)].sort((a, b) => b - a)),
    start_date: v.startDate,
    end_date: v.endDate,
    active: v.active ? 1 : 0,
    payout_date: v.kind === 'tontine' ? v.payoutDate : null,
    payout_minor: v.kind === 'tontine' ? v.payoutMinor : null,
    payout_auto: v.payoutAuto ? 1 : 0,
    note: v.note,
  };
}

export async function createRecurring(db: Db, input: RecurringInput): Promise<string> {
  const values = recurringValues(input);
  return write(db, (w) => w.insert('money_recurring', { ...values, payout_recorded: 0 }));
}

export async function updateRecurring(db: Db, id: string, input: RecurringInput) {
  const values = recurringValues(input);
  return write(db, async (w) => {
    const current = await w.db.getFirstAsync<{ payout_date: string | null }>(
      'SELECT payout_date FROM money_recurring WHERE id = ?',
      [id],
    );
    // Nouveau tour de tontine : il sera compté à sa nouvelle date.
    const reset: Values =
      current && current.payout_date !== values.payout_date ? { payout_recorded: 0 } : {};
    await w.update('money_recurring', id, { ...values, ...reset });
  });
}

/** Supprimer une charge fixe : les paiements déjà notés restent (détachés). */
export async function deleteRecurring(db: Db, id: string) {
  return write(db, async (w) => {
    const paid = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM money_transactions WHERE ${ALIVE} AND recurring_id = ?`,
      [id],
    );
    for (const p of paid)
      await w.update('money_transactions', p.id, { recurring_id: null, occurrence_date: null });
    await w.softDelete('money_recurring', id);
  });
}

async function recurringRow(w: EntityWriter, id: string) {
  const row = await w.db.getFirstAsync<RecurringRow>(
    `SELECT * FROM money_recurring WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  if (!row) throw new AppError('notFound');
  return toRecurring(row);
}

/** « Payé » : l'échéance devient une dépense du jour choisi (par défaut, la date de l'échéance). */
export async function payDue(
  db: Db,
  recurringId: string,
  occurrenceDate: IsoDate,
  paidOn: IsoDate = occurrenceDate,
  amountMinor?: number,
): Promise<string> {
  return write(db, async (w) => {
    const r = await recurringRow(w, recurringId);
    const existing = await w.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM money_transactions WHERE ${ALIVE} AND recurring_id = ? AND occurrence_date = ? AND kind = 'expense'`,
      [recurringId, occurrenceDate],
    );
    if (existing) return existing.id;
    const values = transactionValues({
      kind: 'expense',
      amountMinor: amountMinor ?? r.amountMinor,
      currency: r.currency,
      categoryId: r.categoryId ?? (r.kind === 'tontine' ? TONTINE_EXPENSE : null),
      date: paidOn,
      note: r.name,
      recurringId: r.id,
      occurrenceDate,
    });
    return w.insert('money_transactions', values);
  });
}

/** Annule un « payé » (la dépense correspondante est supprimée). */
export async function unpayDue(db: Db, recurringId: string, occurrenceDate: IsoDate) {
  return write(db, async (w) => {
    const rows = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM money_transactions WHERE ${ALIVE} AND recurring_id = ? AND occurrence_date = ? AND kind = 'expense'`,
      [recurringId, occurrenceDate],
    );
    for (const r of rows) await w.softDelete('money_transactions', r.id);
  });
}

/**
 * Tours de tontine arrivés : ajoutés aux entrées (si « compter automatiquement » est activé),
 * une seule fois par tour. Retourne le nombre d'entrées ajoutées.
 */
export async function recordDuePayouts(db: Db, today: IsoDate): Promise<number> {
  const due = await db.getAllAsync<RecurringRow>(
    `SELECT * FROM money_recurring WHERE ${ALIVE} AND kind = 'tontine' AND payout_auto = 1
       AND payout_recorded = 0 AND payout_date IS NOT NULL AND payout_date <= ? AND payout_minor > 0`,
    [today],
  );
  if (due.length === 0) return 0;
  return write(db, async (w) => {
    for (const row of due) {
      const r = toRecurring(row);
      await w.insert(
        'money_transactions',
        transactionValues({
          kind: 'income',
          amountMinor: r.payoutMinor ?? 0,
          currency: r.currency,
          categoryId: TONTINE_INCOME,
          date: r.payoutDate as string,
          note: r.name,
          recurringId: r.id,
          occurrenceDate: r.payoutDate,
        }),
      );
      await w.update('money_recurring', r.id, { payout_recorded: 1 });
    }
    return due.length;
  });
}

// ---- Épargne ----
function goalValues(input: GoalInput): Values {
  const v = parseInput(goalInputSchema, input);
  return { name: v.name, target_minor: v.targetMinor, currency: v.currency, deadline: v.deadline };
}

export async function createGoal(db: Db, input: GoalInput): Promise<string> {
  const values = goalValues(input);
  return write(db, (w) => w.insert('money_goals', { ...values, archived: 0 }));
}

export async function updateGoal(db: Db, id: string, input: GoalInput) {
  const values = goalValues(input);
  return write(db, (w) => w.update('money_goals', id, values));
}

export async function setGoalArchived(db: Db, id: string, archived: boolean) {
  return write(db, (w) => w.update('money_goals', id, { archived: archived ? 1 : 0 }));
}

/** Supprimer un objectif : l'argent mis de côté revient dans ce qu'il te reste. */
export async function deleteGoal(db: Db, id: string) {
  return write(db, async (w) => {
    const moves = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM money_transactions WHERE ${ALIVE} AND goal_id = ?`,
      [id],
    );
    for (const m of moves) await w.softDelete('money_transactions', m.id);
    await w.softDelete('money_goals', id);
  });
}

// ---- Prêts ----
function loanValues(input: LoanInput): Values {
  const v = parseInput(loanInputSchema, input);
  return { direction: v.direction, person: v.person, due_date: v.dueDate, note: v.note };
}

/** Nouveau prêt : la fiche et le premier mouvement d'argent, dans une seule transaction. */
export async function createLoan(
  db: Db,
  input: LoanInput,
  first: { amountMinor: number; currency: string; date: IsoDate },
): Promise<string> {
  const values = loanValues(input);
  const kind = values.direction === 'lent' ? 'lend' : 'borrow';
  const tx = transactionValues({ kind, ...first });
  return write(db, async (w) => {
    const id = await w.insert('money_loans', { ...values, closed: 0 });
    await w.insert('money_transactions', { ...tx, loan_id: id, note: values.person as string });
    return id;
  });
}

export async function updateLoan(db: Db, id: string, input: LoanInput) {
  const values = loanValues(input);
  return write(db, (w) => w.update('money_loans', id, values));
}

export async function setLoanClosed(db: Db, id: string, closed: boolean) {
  return write(db, (w) => w.update('money_loans', id, { closed: closed ? 1 : 0 }));
}

export async function deleteLoan(db: Db, id: string) {
  return write(db, async (w) => {
    const moves = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM money_transactions WHERE ${ALIVE} AND loan_id = ?`,
      [id],
    );
    for (const m of moves) await w.softDelete('money_transactions', m.id);
    await w.softDelete('money_loans', id);
  });
}
