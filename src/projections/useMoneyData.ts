import {
  balanceBefore,
  getMoneyPrefs,
  listCategories,
  listGoals,
  listLinkedTransactions,
  listLoans,
  listRecurring,
  listTransactions,
  periodContaining,
  shiftPeriod,
  type MoneyPrefs,
} from '@/modules/finance';
import { toIsoDate } from '@/shared/dates';
import { useSharedLiveQuery, type Db } from '@/shared/db';

import { LATE_PERIODS, moneyOverview, type MoneyInput, type MoneyOverview } from './money';

const TABLES = [
  'money_transactions',
  'money_categories',
  'money_recurring',
  'money_goals',
  'money_loans',
  'app_settings',
] as const;

export type MoneyData = { prefs: MoneyPrefs; overview: MoneyOverview; input: MoneyInput };

/** Charge tout ce qu'il faut pour une période (0 = la période en cours, −1 = la précédente…). */
export async function loadMoney(
  db: Db,
  offset = 0,
  today = toIsoDate(new Date()),
): Promise<MoneyData> {
  const prefs = await getMoneyPrefs(db);
  let range = periodContaining(today, prefs.period);
  for (let i = 0; i < Math.abs(offset); i++)
    range = shiftPeriod(range, prefs.period, offset < 0 ? -1 : 1);
  // Les périodes précédentes servent aux tendances et aux échéances restées impayées (en retard).
  let earliest = range;
  for (let i = 0; i < LATE_PERIODS; i++) earliest = shiftPeriod(earliest, prefs.period, -1);
  const [transactions, balance, recurring, goals, loans, linked, categories] = await Promise.all([
    listTransactions(db, { from: earliest.from, to: range.to }),
    balanceBefore(db, range.from, prefs.currency),
    listRecurring(db),
    listGoals(db),
    listLoans(db),
    listLinkedTransactions(db),
    listCategories(db),
  ]);
  const input: MoneyInput = {
    today,
    currency: prefs.currency,
    period: prefs.period,
    range,
    transactions,
    balanceBeforeRange: balance,
    recurring,
    goals,
    loans,
    linked,
    categories,
  };
  return { prefs, input, overview: moneyOverview(input) };
}

/** Données de l'onglet Argent, rechargées à chaque opération notée, au retour de l'app et au changement de jour. */
export function useMoneyData(offset = 0) {
  return useSharedLiveQuery(`money:${offset}`, (db) => loadMoney(db, offset), TABLES, {
    refreshOn: 'foreground',
  });
}
