import type { Transaction } from '@/modules/finance';

import { moneyOverview } from './money';
import { buildWidgetMoney } from './widgetMoney';

const tx = (
  id: string,
  kind: Transaction['kind'],
  amountMinor: number,
  date: string,
  categoryId: string,
): Transaction => ({
  id,
  kind,
  amountMinor,
  currency: 'XAF',
  categoryId,
  date,
  note: null,
  recurringId: null,
  occurrenceDate: null,
  goalId: null,
  loanId: null,
});

const overview = moneyOverview({
  today: '2026-09-25',
  currency: 'XAF',
  period: { kind: 'month', startDay: 1 },
  range: { from: '2026-09-01', to: '2026-09-30' },
  transactions: [
    tx('a', 'income', 100000, '2026-09-01', 'family_in'),
    tx('b', 'expense', 2000, '2026-09-24', 'transport'),
    tx('c', 'expense', 1000, '2026-09-25', 'transport'),
    tx('d', 'expense', 500, '2026-09-25', 'water'),
  ],
  balanceBeforeRange: 0,
  recurring: [],
  goals: [],
  loans: [],
  linked: [],
  categories: [],
});
const texts = {
  t: (key: string, p?: Record<string, string | number>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
  weekdayShort: (n: number) => ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'][n - 1]!,
  shortDate: (iso: string) => iso,
};

describe('widgets Argent', () => {
  it('catégories les plus utilisées d’abord, liens vers la saisie avec la catégorie', () => {
    const w = buildWidgetMoney(overview, [], false, texts);
    expect(w.left).toBe('96 500 FCFA');
    expect(w.todaySpent).toBe('1 500 FCFA');
    expect(w.quick.map((b) => b.url)).toEqual([
      'mysky://money/add?kind=expense&category=transport',
      'mysky://money/add?kind=expense&category=water',
      'mysky://money/add?kind=expense&category=food',
      'mysky://money/add?kind=expense',
    ]);
    expect(w.week.map((d) => d.value)).toEqual([0, 0, 0, 0, 0, 2000, 1500]);
    expect(w.week[6]).toMatchObject({ label: 'V', today: true });
  });

  it('montants masqués sur demande', () => {
    const w = buildWidgetMoney(overview, [], true, texts);
    expect([w.left, w.todaySpent, w.weekTotal]).toEqual(['•••', '•••', '•••']);
  });
});
