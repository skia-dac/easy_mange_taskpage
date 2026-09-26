import {
  daysLeft,
  dueItems,
  findCategory,
  occurrencesBetween,
  shiftPeriod,
  signedAmount,
  type BudgetPeriod,
  type DueItem,
  type Goal,
  type Loan,
  type MoneyCategory,
  type PeriodRange,
  type Recurring,
  type Transaction,
} from '@/modules/finance';
import { addDaysIso, isoWeekday, type IsoDate } from '@/shared/dates';

export type MoneyInput = {
  today: IsoDate;
  currency: string;
  period: BudgetPeriod;
  range: PeriodRange;
  /** Opérations des périodes précédentes (jusqu'à `LATE_PERIODS`) ET de la période affichée. */
  transactions: readonly Transaction[];
  /** Solde (toutes opérations) avant le début de la période affichée. */
  balanceBeforeRange: number;
  recurring: readonly Recurring[];
  goals: readonly Goal[];
  loans: readonly Loan[];
  /** Mouvements d'épargne et de prêts, toutes dates. */
  linked: readonly Transaction[];
  categories: readonly MoneyCategory[];
};

export type CategoryTotal = {
  categoryId: string;
  category: MoneyCategory | undefined;
  total: number;
  share: number;
};

export type MoneyInsight =
  | { kind: 'topWeekday'; weekday: number; share: number }
  | { kind: 'categoryUp'; categoryId: string; percent: number }
  | { kind: 'repeating'; categoryId: string; note: string; count: number; averageMinor: number };

export type MoneyOverview = {
  range: PeriodRange;
  currency: string;
  /** Ce qu'il y avait avant la période (reporté). */
  carryOver: number;
  /** Ce qu'il te reste : report + entrées − sorties de la période. */
  balance: number;
  income: number;
  expense: number;
  /** Mis de côté (net) pendant la période. */
  saved: number;
  /** Prêté (net) pendant la période. */
  lent: number;
  borrowed: number;
  due: DueItem[];
  unpaidTotal: number;
  /** Ce qu'il te reste une fois payées les charges fixes et cotisations de la période. */
  afterCharges: number;
  daysLeft: number;
  perDay: number;
  todaySpent: number;
  /** 7 derniers jours (le plus ancien d'abord) : dépenses du jour. */
  last7: { date: IsoDate; total: number }[];
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  /** Part des dépenses par jour de la semaine (1 = lundi … 7 = dimanche). */
  byWeekday: { weekday: number; total: number }[];
  largest: Transaction[];
  goals: { goal: Goal; savedMinor: number }[];
  /** Objectifs archivés (atteints, rangés) : montrés à part, hors des totaux. */
  archivedGoals: { goal: Goal; savedMinor: number }[];
  loans: { loan: Loan; outstandingMinor: number; totalMinor: number }[];
  /** Prochaine cotisation et prochain tour de chaque tontine. */
  tontines: { recurring: Recurring; next: IsoDate | null; payoutDate: IsoDate | null }[];
  insights: MoneyInsight[];
  /** Opérations de la période, les plus récentes d'abord. */
  items: Transaction[];
};

const inRange = (t: { date: string }, r: PeriodRange) => t.date >= r.from && t.date <= r.to;

/** Périodes précédentes dont les échéances impayées restent visibles « en retard ». */
export const LATE_PERIODS = 3;

/** Prêts encore ouverts d'un sens donné (même règle que l'écran Prêts : ni clôturé, ni soldé). */
export function openLoans<T extends { loan: Loan; outstandingMinor: number }>(
  loans: readonly T[],
  direction: Loan['direction'],
): T[] {
  return loans.filter(
    (l) => l.loan.direction === direction && !l.loan.closed && l.outstandingMinor > 0,
  );
}

function totals(list: readonly Transaction[], cats: readonly MoneyCategory[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const t of list) {
    const id = t.categoryId ?? (t.kind === 'income' ? 'other_in' : 'other');
    map.set(id, (map.get(id) ?? 0) + t.amountMinor);
  }
  const sum = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      category: findCategory(categoryId, cats),
      total,
      share: sum > 0 ? total / sum : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

const net = (list: readonly Transaction[], plus: string, minus: string) =>
  list.reduce(
    (s, t) => s + (t.kind === plus ? t.amountMinor : t.kind === minus ? -t.amountMinor : 0),
    0,
  );

/** Vue d'ensemble de l'argent pour une période (fonction pure, testée). */
export function moneyOverview(input: MoneyInput): MoneyOverview {
  const { today, range, currency } = input;
  const mine = input.transactions.filter((t) => t.currency === currency);
  const items = mine.filter((t) => inRange(t, range)).sort((a, b) => b.date.localeCompare(a.date));
  const previous = shiftPeriod(range, input.period, -1);
  const before = mine.filter((t) => inRange(t, previous));
  const expenses = items.filter((t) => t.kind === 'expense');

  const balance = input.balanceBeforeRange + items.reduce((s, t) => s + signedAmount(t), 0);
  const recurring = input.recurring.filter((r) => r.currency === currency);
  // Période en cours : une échéance des périodes précédentes restée impayée ne disparaît pas,
  // elle reste « en retard » dans « à payer » et dans « après tes charges ».
  let lateFrom = range.from;
  if (inRange({ date: today }, range))
    for (let i = 0; i < LATE_PERIODS; i++)
      lateFrom = shiftPeriod({ from: lateFrom, to: lateFrom }, input.period, -1).from;
  const late =
    lateFrom < range.from
      ? dueItems(recurring, mine, lateFrom, addDaysIso(range.from, -1)).filter((d) => !d.paid)
      : [];
  const due = [...late, ...dueItems(recurring, mine, range.from, range.to)];
  const unpaidTotal = due.filter((d) => !d.paid).reduce((s, d) => s + d.amountMinor, 0);
  const afterCharges = balance - unpaidTotal;
  const left = daysLeft(range, today);

  const byDay = new Map<string, number>();
  for (const t of mine)
    if (t.kind === 'expense') byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amountMinor);
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(today, i - 6);
    return { date, total: byDay.get(date) ?? 0 };
  });

  const wd = new Map<number, number>();
  for (const t of expenses)
    wd.set(isoWeekday(t.date), (wd.get(isoWeekday(t.date)) ?? 0) + t.amountMinor);
  const byWeekday = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    total: wd.get(weekday) ?? 0,
  }));

  const byCategory = totals(expenses, input.categories);
  const insights: MoneyInsight[] = [];
  const expenseTotal = expenses.reduce((s, t) => s + t.amountMinor, 0);
  const activeDays = new Set(expenses.map((t) => t.date)).size;
  const top = [...byWeekday].sort((a, b) => b.total - a.total)[0];
  if (top && expenseTotal > 0 && activeDays >= 3 && top.total / expenseTotal >= 0.25) {
    insights.push({ kind: 'topWeekday', weekday: top.weekday, share: top.total / expenseTotal });
  }
  const prevByCat = new Map(
    totals(
      before.filter((t) => t.kind === 'expense'),
      input.categories,
    ).map((c) => [c.categoryId, c.total]),
  );
  for (const c of byCategory) {
    const was = prevByCat.get(c.categoryId) ?? 0;
    if (was > 0 && c.total >= was * 1.2 && c.total - was >= expenseTotal * 0.05) {
      insights.push({
        kind: 'categoryUp',
        categoryId: c.categoryId,
        percent: Math.round((c.total / was - 1) * 100),
      });
    }
  }
  // Même dépense notée souvent, sans charge fixe : proposer d'en faire une.
  const repeated = new Map<string, Transaction[]>();
  for (const t of [...before, ...items]) {
    if (t.kind !== 'expense' || t.recurringId || !t.note) continue;
    const key = `${t.categoryId ?? ''}|${t.note.trim().toLowerCase()}`;
    repeated.set(key, [...(repeated.get(key) ?? []), t]);
  }
  for (const list of repeated.values()) {
    if (list.length >= 3 && list.some((t) => inRange(t, range))) {
      const first = list[0] as Transaction;
      insights.push({
        kind: 'repeating',
        categoryId: first.categoryId ?? 'other',
        note: first.note ?? '',
        count: list.length,
        averageMinor: Math.round(list.reduce((s, t) => s + t.amountMinor, 0) / list.length),
      });
    }
  }

  const linked = input.linked.filter((t) => t.currency === currency);
  const withSaved = (goal: Goal) => ({
    goal,
    savedMinor: net(
      linked.filter((t) => t.goalId === goal.id),
      'saving',
      'saving_back',
    ),
  });
  const goals = input.goals.filter((g) => !g.archived).map(withSaved);
  const archivedGoals = input.goals.filter((g) => g.archived).map(withSaved);
  // Un prêt a la devise de son premier mouvement : seuls ceux de la devise affichée comptent
  // (sinon un prêt en EUR paraît « réglé » quand on regarde les XAF).
  const loans = input.loans
    .filter((loan) => loan.currency === currency)
    .map((loan) => {
      const moves = linked.filter((t) => t.loanId === loan.id);
      const [out, back] =
        loan.direction === 'lent' ? ['lend', 'lend_back'] : ['borrow', 'borrow_back'];
      const totalMinor = moves.filter((t) => t.kind === out).reduce((s, t) => s + t.amountMinor, 0);
      return { loan, totalMinor, outstandingMinor: net(moves, out, back) };
    });

  const tontines = input.recurring
    .filter((r) => r.kind === 'tontine' && r.active)
    .map((recurring) => ({
      recurring,
      next: occurrencesBetween(recurring, today, addDaysIso(today, 62))[0] ?? null,
      payoutDate:
        recurring.payoutDate && recurring.payoutDate >= today ? recurring.payoutDate : null,
    }));

  return {
    range,
    currency,
    carryOver: input.balanceBeforeRange,
    balance,
    income: items.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amountMinor, 0),
    expense: expenseTotal,
    saved: net(items, 'saving', 'saving_back'),
    lent: net(items, 'lend', 'lend_back'),
    borrowed: net(items, 'borrow', 'borrow_back'),
    due,
    unpaidTotal,
    afterCharges,
    daysLeft: left,
    perDay: today > range.to ? 0 : Math.max(0, Math.floor(afterCharges / left)),
    todaySpent: byDay.get(today) ?? 0,
    last7,
    byCategory,
    incomeByCategory: totals(
      items.filter((t) => t.kind === 'income'),
      input.categories,
    ),
    byWeekday,
    largest: [...expenses].sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 5),
    goals,
    archivedGoals,
    loans,
    tontines,
    insights,
    items,
  };
}
