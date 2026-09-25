import { enumOr } from '@/shared/validation';
import { categoryKinds, type MoneyCategory } from '../domain/category';
import type { Goal } from '../domain/goal';
import { loanDirections, type Loan } from '../domain/loan';
import { frequencies, recurringKinds, type Recurring } from '../domain/recurring';
import { transactionKinds, type Transaction } from '../domain/transaction';

export type TransactionRow = {
  id: string;
  kind: string;
  amount_minor: number;
  currency: string;
  category_id: string | null;
  date: string;
  note: string | null;
  recurring_id: string | null;
  occurrence_date: string | null;
  goal_id: string | null;
  loan_id: string | null;
};

export const toTransaction = (r: TransactionRow): Transaction => ({
  id: r.id,
  kind: enumOr(transactionKinds, r.kind, 'expense'),
  amountMinor: r.amount_minor,
  currency: r.currency,
  categoryId: r.category_id,
  date: r.date,
  note: r.note,
  recurringId: r.recurring_id,
  occurrenceDate: r.occurrence_date,
  goalId: r.goal_id,
  loanId: r.loan_id,
});

export type CategoryRow = {
  id: string;
  kind: string;
  name: string;
  icon: string;
  color_id: string;
  position: number;
};

export const toCategory = (r: CategoryRow): MoneyCategory => ({
  id: r.id,
  kind: enumOr(categoryKinds, r.kind, 'expense'),
  builtIn: false,
  name: r.name,
  icon: r.icon,
  colorId: r.color_id,
  position: r.position,
});

export type RecurringRow = {
  id: string;
  kind: string;
  name: string;
  category_id: string | null;
  amount_minor: number;
  currency: string;
  frequency: string;
  day_of_month: number;
  weekday: number;
  time: string | null;
  reminders: string;
  start_date: string;
  end_date: string | null;
  active: number;
  payout_date: string | null;
  payout_minor: number | null;
  payout_auto: number;
  payout_recorded: number;
  note: string | null;
};

function parseReminders(json: string): number[] {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export const toRecurring = (r: RecurringRow): Recurring => ({
  id: r.id,
  kind: enumOr(recurringKinds, r.kind, 'charge'),
  name: r.name,
  categoryId: r.category_id,
  amountMinor: r.amount_minor,
  currency: r.currency,
  frequency: enumOr(frequencies, r.frequency, 'monthly'),
  dayOfMonth: r.day_of_month,
  weekday: r.weekday,
  time: r.time,
  reminders: parseReminders(r.reminders),
  startDate: r.start_date,
  endDate: r.end_date,
  active: r.active === 1,
  payoutDate: r.payout_date,
  payoutMinor: r.payout_minor,
  payoutAuto: r.payout_auto === 1,
  payoutRecorded: r.payout_recorded === 1,
  note: r.note,
});

export type GoalRow = {
  id: string;
  name: string;
  target_minor: number;
  currency: string;
  deadline: string | null;
  archived: number;
};

export const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  name: r.name,
  targetMinor: r.target_minor,
  currency: r.currency,
  deadline: r.deadline,
  archived: r.archived === 1,
});

export type LoanRow = {
  id: string;
  direction: string;
  person: string;
  due_date: string | null;
  note: string | null;
  closed: number;
};

export const toLoan = (r: LoanRow): Loan => ({
  id: r.id,
  direction: enumOr(loanDirections, r.direction, 'lent'),
  person: r.person,
  dueDate: r.due_date,
  note: r.note,
  closed: r.closed === 1,
});
