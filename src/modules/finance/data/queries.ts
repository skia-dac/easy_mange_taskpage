import type { IsoDate } from '@/shared/dates';
import type { Db } from '@/shared/db';

import {
  toCategory,
  toGoal,
  toLoan,
  toRecurring,
  toTransaction,
  type CategoryRow,
  type GoalRow,
  type LoanRow,
  type RecurringRow,
  type TransactionRow,
} from './rows';

const ALIVE = 'deleted_at IS NULL';

/** Opérations entre deux dates (incluses), les plus récentes d'abord. */
export async function listTransactions(db: Db, range: { from?: IsoDate; to?: IsoDate } = {}) {
  const where = [ALIVE];
  const params: string[] = [];
  if (range.from) {
    where.push('date >= ?');
    params.push(range.from);
  }
  if (range.to) {
    where.push('date <= ?');
    params.push(range.to);
  }
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM money_transactions WHERE ${where.join(' AND ')} ORDER BY date DESC, created_at DESC`,
    params,
  );
  return rows.map(toTransaction);
}

export async function getTransaction(db: Db, id: string) {
  const row = await db.getFirstAsync<TransactionRow>(
    `SELECT * FROM money_transactions WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toTransaction(row) : null;
}

/** Solde avant une date (argent reçu − argent sorti), pour une monnaie. */
export async function balanceBefore(db: Db, date: IsoDate, currency: string): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(CASE WHEN kind IN ('income', 'saving_back', 'lend_back', 'borrow') THEN amount_minor
                     ELSE -amount_minor END) AS total
       FROM money_transactions WHERE ${ALIVE} AND currency = ? AND date < ?`,
    [currency, date],
  );
  return row?.total ?? 0;
}

/** Mouvements d'épargne et de prêts (toutes dates) : pour les soldes des objectifs et des prêts. */
export async function listLinkedTransactions(db: Db) {
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM money_transactions WHERE ${ALIVE} AND (goal_id IS NOT NULL OR loan_id IS NOT NULL)
     ORDER BY date DESC`,
    [],
  );
  return rows.map(toTransaction);
}

export async function listCategories(db: Db) {
  const rows = await db.getAllAsync<CategoryRow>(
    `SELECT * FROM money_categories WHERE ${ALIVE} AND archived = 0 ORDER BY position`,
    [],
  );
  return rows.map(toCategory);
}

export async function listRecurring(db: Db) {
  const rows = await db.getAllAsync<RecurringRow>(
    `SELECT * FROM money_recurring WHERE ${ALIVE} ORDER BY kind, name`,
    [],
  );
  return rows.map(toRecurring);
}

export async function getRecurring(db: Db, id: string) {
  const row = await db.getFirstAsync<RecurringRow>(
    `SELECT * FROM money_recurring WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toRecurring(row) : null;
}

export async function listGoals(db: Db) {
  const rows = await db.getAllAsync<GoalRow>(
    `SELECT * FROM money_goals WHERE ${ALIVE} ORDER BY archived, created_at`,
    [],
  );
  return rows.map(toGoal);
}

export async function getGoal(db: Db, id: string) {
  const row = await db.getFirstAsync<GoalRow>(
    `SELECT * FROM money_goals WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toGoal(row) : null;
}

export async function listLoans(db: Db) {
  const rows = await db.getAllAsync<LoanRow>(
    `SELECT * FROM money_loans WHERE ${ALIVE} ORDER BY closed, created_at DESC`,
    [],
  );
  return rows.map(toLoan);
}

export async function getLoan(db: Db, id: string) {
  const row = await db.getFirstAsync<LoanRow>(
    `SELECT * FROM money_loans WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toLoan(row) : null;
}

export async function searchTransactions(db: Db, query: string) {
  const q = `%${query.trim().replace(/[%_\\]/g, '')}%`;
  const rows = await db.getAllAsync<TransactionRow>(
    `SELECT * FROM money_transactions WHERE ${ALIVE} AND note LIKE ? ORDER BY date DESC LIMIT 20`,
    [q],
  );
  return rows.map(toTransaction);
}
