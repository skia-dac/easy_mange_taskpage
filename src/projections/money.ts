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
import { addDaysIso, fromIsoDate, isoWeekday, type IsoDate } from '@/shared/dates';

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
  /**
   * Échéances en retard payées pendant cette session, dans la période affichée (`dueKey`) : elles
   * restent visibles (cochées) pour pouvoir être décochées, jusqu'au changement de période.
   */
  keepPaidLate?: ReadonlySet<string>;
};

/** Identifiant stable d'une échéance (charge fixe + date prévue). */
export const dueKey = (d: { recurring: { id: string }; date: string }) =>
  `${d.recurring.id}|${d.date}`;

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
  /**
   * Tuile « Prêts » : les deux sens, dans la devise affichée, prêts ouverts seulement (mêmes
   * règles que l'écran Prêts). `owedToMeMinor` = « On me doit », `iOweMinor` = « Je dois ».
   */
  loanTotals: { owedToMeMinor: number; iOweMinor: number };
  /**
   * Tuile « Épargne » : ce qui est mis de côté sur les objectifs actifs, regroupé par devise
   * (jamais d'addition entre devises). La devise affichée d'abord (toujours présente), puis les
   * autres devises qui ont de l'épargne, par ordre alphabétique.
   */
  savingsByCurrency: { currency: string; savedMinor: number }[];
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
  // elle reste « en retard » dans « à payer » et dans « après tes charges ». Payée, elle sort
  // de la liste, sauf si elle vient d'être payée pendant cette session (pour pouvoir la décocher).
  let lateFrom = range.from;
  if (inRange({ date: today }, range))
    for (let i = 0; i < LATE_PERIODS; i++)
      lateFrom = shiftPeriod({ from: lateFrom, to: lateFrom }, input.period, -1).from;
  const late =
    lateFrom < range.from
      ? dueItems(recurring, mine, lateFrom, addDaysIso(range.from, -1)).filter(
          (d) => !d.paid || (input.keepPaidLate?.has(dueKey(d)) ?? false),
        )
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

  const outstanding = (direction: Loan['direction']) =>
    openLoans(loans, direction).reduce((s, l) => s + l.outstandingMinor, 0);
  const loanTotals = { owedToMeMinor: outstanding('lent'), iOweMinor: outstanding('borrowed') };

  // Chaque objectif compte dans SA devise (ses mouvements ont forcément sa devise).
  const savedBy = new Map<string, number>([[currency, 0]]);
  for (const goal of input.goals) {
    if (goal.archived) continue;
    const saved = net(
      input.linked.filter((t) => t.goalId === goal.id && t.currency === goal.currency),
      'saving',
      'saving_back',
    );
    savedBy.set(goal.currency, (savedBy.get(goal.currency) ?? 0) + saved);
  }
  const savingsByCurrency = [...savedBy.entries()]
    .filter(([c, savedMinor]) => c === currency || savedMinor !== 0)
    .map(([c, savedMinor]) => ({ currency: c, savedMinor }))
    .sort((a, b) =>
      a.currency === currency
        ? -1
        : b.currency === currency
          ? 1
          : a.currency.localeCompare(b.currency),
    );

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
    loanTotals,
    savingsByCurrency,
    tontines,
    insights,
    items,
  };
}

/**
 * Une charge fixe ou une tontine dans « À payer » : toutes ses échéances de la liste réunies en
 * une ligne (une tontine hebdomadaire tombe 4 ou 5 fois dans le mois).
 */
export type DueGroup = {
  recurring: Recurring;
  /** Ses échéances, la plus ancienne d'abord (retards compris). */
  items: DueItem[];
  /** La première échéance impayée : c'est elle que la case paie. `null` : tout est payé. */
  next: DueItem | null;
  /** La dernière échéance payée : c'est elle que la case décoche quand tout est payé. */
  lastPaid: DueItem | null;
  count: number;
  paidCount: number;
  /** Total des échéances de la ligne (payées ou non). */
  totalMinor: number;
  /** Ce qu'il reste à payer sur la ligne. */
  unpaidMinor: number;
  /** La prochaine échéance impayée est passée. */
  late: boolean;
};

/**
 * Regroupe les échéances par charge fixe ou tontine. Ordre : en retard d'abord (le plus ancien
 * retard en tête), puis les prochaines échéances par date, puis les lignes entièrement payées.
 */
export function groupDue(due: readonly DueItem[], today: IsoDate): DueGroup[] {
  const byId = new Map<string, DueItem[]>();
  for (const d of due) byId.set(d.recurring.id, [...(byId.get(d.recurring.id) ?? []), d]);
  const groups = [...byId.values()].map((list): DueGroup => {
    const items = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const first = items[0] as DueItem;
    const next = items.find((d) => !d.paid) ?? null;
    const paid = items.filter((d) => d.paid);
    return {
      recurring: first.recurring,
      items,
      next,
      lastPaid: paid[paid.length - 1] ?? null,
      count: items.length,
      paidCount: paid.length,
      totalMinor: items.reduce((s, d) => s + d.amountMinor, 0),
      unpaidMinor: items.filter((d) => !d.paid).reduce((s, d) => s + d.amountMinor, 0),
      late: next !== null && next.date < today,
    };
  });
  const rank = (g: DueGroup) => (g.late ? 0 : g.next ? 1 : 2);
  const when = (g: DueGroup) => g.next?.date ?? g.lastPaid?.date ?? '';
  return groups.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      when(a).localeCompare(when(b)) ||
      a.recurring.name.localeCompare(b.recurring.name),
  );
}

/** La période affichée est en cours, terminée ou à venir. */
export type PeriodTense = 'current' | 'past' | 'future';

export function periodTense(range: PeriodRange, today: IsoDate): PeriodTense {
  return today < range.from ? 'future' : today > range.to ? 'past' : 'current';
}

/** Ce que montre la carte principale de l'onglet Argent. */
export type MoneyHero = {
  tense: PeriodTense;
  /** Découvert (montant positif) quand le solde est négatif, sinon 0. */
  deficitMinor: number;
  /**
   * Barre « ce qui reste de l'argent disponible » (report positif + entrées de la période).
   * `null` quand elle ne voudrait rien dire : rien de disponible, solde négatif, période à venir.
   */
  bar: { leftPercent: number; availableMinor: number } | null;
  /** Report de la période précédente, `null` quand il est nul (la ligne est cachée). */
  carryOverMinor: number | null;
};

export function moneyHero(
  o: Pick<MoneyOverview, 'range' | 'balance' | 'income' | 'carryOver'>,
  today: IsoDate,
): MoneyHero {
  const tense = periodTense(o.range, today);
  const availableMinor = o.income + Math.max(0, o.carryOver);
  const bar =
    tense === 'future' || availableMinor <= 0 || o.balance < 0
      ? null
      : {
          leftPercent: Math.round(Math.min(1, o.balance / availableMinor) * 100),
          availableMinor,
        };
  return {
    tense,
    deficitMinor: o.balance < 0 ? -o.balance : 0,
    bar,
    carryOverMinor: o.carryOver === 0 ? null : o.carryOver,
  };
}

const dayMonth = (day: IsoDate, locale: string, withYear: boolean) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  }).format(fromIsoDate(day));

/**
 * Libellé court de la période entre les flèches : « Janvier 2027 » pour un mois qui commence le
 * 1er, sinon « 25 déc. – 24 janv. » (mois décalé ou semaine). L'année n'est ajoutée que si la
 * période sort de l'année en cours. `join` assemble les deux dates (gabarit traduit).
 */
export function periodLabel(
  range: PeriodRange,
  period: BudgetPeriod,
  locale: string,
  today: IsoDate,
  join: (from: string, to: string) => string = (from, to) => `${from} – ${to}`,
): string {
  if (period.kind === 'month' && period.startDay === 1) {
    const text = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      fromIsoDate(range.from),
    );
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  }
  const year = today.slice(0, 4);
  const fromYear = range.from.slice(0, 4);
  const toYear = range.to.slice(0, 4);
  const showYear = fromYear !== year || toYear !== year;
  return join(
    dayMonth(range.from, locale, showYear && fromYear !== toYear),
    dayMonth(range.to, locale, showYear),
  );
}
