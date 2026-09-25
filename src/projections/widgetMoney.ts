import { findCategory, formatMoney, type MoneyCategory } from '@/modules/finance';
import { isoWeekday } from '@/shared/dates';

import type { MoneyOverview } from './money';

export type WidgetMoneyButton = { label: string; url: string; symbol: string; glyph: string };

/** Ce que les widgets « Argent » affichent (textes déjà formatés, montants masqués si demandé). */
export type WidgetMoney = {
  ready: boolean;
  hidden: boolean;
  left: string;
  perDay: string;
  todaySpent: string;
  weekTotal: string;
  week: { label: string; value: number; today: boolean }[];
  weekMax: number;
  /** Prochaines échéances non payées. */
  due: { name: string; when: string; amount: string }[];
  quick: WidgetMoneyButton[];
  expenseUrl: string;
  incomeUrl: string;
  url: string;
  labels: {
    quick: string;
    left: string;
    perDay: string;
    today: string;
    week: string;
    due: string;
    noDue: string;
    expense: string;
    income: string;
    start: string;
  };
};

const BASE = 'mysky://';
const MASK = '•••';

/** Icône SF Symbols (iPhone) et caractère simple (Android) de chaque catégorie de l'app. */
const SYMBOLS: Record<string, [string, string]> = {
  food: ['cart', '🛒'],
  drink: ['cup.and.saucer', '☕'],
  water: ['drop', '💧'],
  transport: ['car', '🛵'],
  clothes: ['tshirt', '👕'],
  shoes: ['shoeprints.fill', '👟'],
  home: ['house', '🏠'],
  electricity: ['bolt', '⚡'],
  internet: ['wifi', '📶'],
  school: ['book', '📚'],
  supplies: ['printer', '🖨'],
  health: ['heart', '❤'],
  outings: ['music.note', '🎵'],
  family: ['person.2', '👪'],
  tontine: ['arrow.2.circlepath', '🔁'],
  other: ['ellipsis', '…'],
};

export const EMPTY_WIDGET_MONEY: WidgetMoney = {
  ready: false,
  hidden: false,
  left: '',
  perDay: '',
  todaySpent: '',
  weekTotal: '',
  week: [],
  weekMax: 1,
  due: [],
  quick: [],
  expenseUrl: `${BASE}money/add?kind=expense`,
  incomeUrl: `${BASE}money/add?kind=income`,
  url: `${BASE}money`,
  labels: {
    quick: '',
    left: '',
    perDay: '',
    today: '',
    week: '',
    due: '',
    noDue: '',
    expense: '',
    income: '',
    start: '',
  },
};

type Texts = {
  t: (key: string, params?: Record<string, string | number>) => string;
  weekdayShort: (isoWeekday: number) => string;
  shortDate: (iso: string) => string;
};

/** Données des widgets Argent à partir de la vue d'ensemble (fonction pure). */
export function buildWidgetMoney(
  o: MoneyOverview,
  categories: readonly MoneyCategory[],
  hidden: boolean,
  texts: Texts,
): WidgetMoney {
  const m = (v: number) => (hidden ? MASK : formatMoney(v, o.currency));
  // Les 3 catégories les plus utilisées de la période, complétées par les classiques.
  const counts = new Map<string, number>();
  for (const t of o.items)
    if (t.kind === 'expense' && t.categoryId)
      counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const ids = [...new Set([...ranked, 'food', 'transport', 'drink'])]
    .filter((id) => id !== 'other')
    .slice(0, 3);
  const name = (id: string) => {
    const c = findCategory(id, categories);
    return !c || c.builtIn ? texts.t(`money.cat.${id}`) : (c.name ?? '');
  };
  const button = (id: string): WidgetMoneyButton => {
    const [symbol, glyph] = SYMBOLS[id] ?? ['tag', '•'];
    return {
      label: name(id),
      url: `${BASE}money/add?kind=expense&category=${encodeURIComponent(id)}`,
      symbol,
      glyph,
    };
  };
  const today = o.last7[o.last7.length - 1]?.date;
  return {
    ready: true,
    hidden,
    left: m(o.balance),
    perDay: texts.t('widget.moneyPerDay', { amount: m(o.perDay) }),
    todaySpent: m(o.todaySpent),
    weekTotal: m(o.last7.reduce((s, d) => s + d.total, 0)),
    week: o.last7.map((d) => ({
      label: texts.weekdayShort(isoWeekday(d.date)).slice(0, 1).toUpperCase(),
      value: d.total,
      today: d.date === today,
    })),
    weekMax: Math.max(1, ...o.last7.map((d) => d.total)),
    due: o.due
      .filter((d) => !d.paid)
      .slice(0, 3)
      .map((d) => ({
        name: d.recurring.name,
        when: texts.shortDate(d.date),
        amount: m(d.amountMinor),
      })),
    quick: [
      ...ids.map(button),
      {
        ...button('other'),
        label: texts.t('money.cat.other'),
        url: `${BASE}money/add?kind=expense`,
      },
    ],
    expenseUrl: `${BASE}money/add?kind=expense`,
    incomeUrl: `${BASE}money/add?kind=income`,
    url: `${BASE}money`,
    labels: {
      quick: texts.t('widget.moneyQuick'),
      left: texts.t('widget.moneyLeft'),
      perDay: texts.t('widget.moneyPerDayLabel'),
      today: texts.t('widget.moneyToday'),
      week: texts.t('widget.moneyWeek'),
      due: texts.t('widget.moneyDue'),
      noDue: texts.t('widget.moneyNoDue'),
      expense: texts.t('money.expense'),
      income: texts.t('money.income'),
      start: texts.t('widget.moneyStart'),
    },
  };
}
