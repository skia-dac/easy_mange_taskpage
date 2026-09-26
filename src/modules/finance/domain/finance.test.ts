import { amountInput, formatMoney, parseAmount } from './money';
import { daysLeft, periodContaining, shiftPeriod } from './period';
import { dueItems, occurrencesBetween, type Recurring } from './recurring';

describe('montants', () => {
  it('affiche le FCFA sans décimales et l’euro avec', () => {
    expect(formatMoney(128400, 'XAF')).toBe('128 400 FCFA');
    expect(formatMoney(-1500, 'XAF')).toBe('−1 500 FCFA');
    expect(formatMoney(1500, 'XAF', { signed: true })).toBe('+1 500 FCFA');
    expect(formatMoney(1250, 'EUR')).toBe('12,50 €');
    expect(formatMoney(5000, 'XAF', { symbol: false })).toBe('5 000');
  });

  it('lit un montant saisi, refuse le reste', () => {
    expect(parseAmount('12 500', 'XAF')).toBe(12500);
    expect(parseAmount('12,5', 'EUR')).toBe(1250);
    expect(parseAmount('12.50', 'EUR')).toBe(1250);
    expect(parseAmount('12,5', 'XAF')).toBeNull();
    expect(parseAmount('0', 'XAF')).toBeNull();
    expect(parseAmount('abc', 'XAF')).toBeNull();
    expect(amountInput(1250, 'EUR')).toBe('12,50');
  });
});

describe('période de budget', () => {
  it('mois qui commence le 25', () => {
    const p = { kind: 'month' as const, startDay: 25 };
    expect(periodContaining('2026-09-25', p)).toEqual({ from: '2026-09-25', to: '2026-10-24' });
    expect(periodContaining('2026-09-10', p)).toEqual({ from: '2026-08-25', to: '2026-09-24' });
    expect(periodContaining('2026-01-03', p)).toEqual({ from: '2025-12-25', to: '2026-01-24' });
  });

  it('mois qui commence le 31 : dernier jour des mois courts', () => {
    const p = { kind: 'month' as const, startDay: 31 };
    expect(periodContaining('2026-03-05', p)).toEqual({ from: '2026-02-28', to: '2026-03-30' });
  });

  it('semaine qui commence le samedi, période suivante, jours restants', () => {
    const p = { kind: 'week' as const, startWeekday: 6 };
    const r = periodContaining('2026-09-25', p);
    expect(r).toEqual({ from: '2026-09-19', to: '2026-09-25' });
    expect(shiftPeriod(r, p, 1)).toEqual({ from: '2026-09-26', to: '2026-10-02' });
    expect(daysLeft(r, '2026-09-25')).toBe(1);
    expect(daysLeft({ from: '2026-09-01', to: '2026-09-30' }, '2026-09-25')).toBe(6);
  });
});

describe('charges fixes et tontines', () => {
  const base: Recurring = {
    id: 'r',
    kind: 'charge',
    name: 'Loyer',
    categoryId: 'home',
    amountMinor: 35000,
    currency: 'XAF',
    frequency: 'monthly',
    dayOfMonth: 31,
    weekday: 6,
    time: null,
    reminders: [],
    startDate: '2026-01-01',
    endDate: null,
    active: true,
    payoutDate: null,
    payoutMinor: null,
    payoutAuto: true,
    payoutRecorded: false,
    note: null,
  };

  it('mensuel au 31 : le dernier jour des mois plus courts ; hebdomadaire le samedi', () => {
    expect(occurrencesBetween(base, '2026-02-01', '2026-04-30')).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(
      occurrencesBetween({ ...base, frequency: 'weekly', weekday: 6 }, '2026-09-21', '2026-10-04'),
    ).toEqual(['2026-09-26', '2026-10-03']);
    expect(occurrencesBetween({ ...base, active: false }, '2026-02-01', '2026-04-30')).toEqual([]);
  });

  it('une échéance est payée quand une dépense y est rattachée', () => {
    const due = dueItems(
      [{ ...base, dayOfMonth: 1 }],
      [{ id: 't', kind: 'expense', recurringId: 'r', occurrenceDate: '2026-09-01' }],
      '2026-09-01',
      '2026-10-31',
    );
    expect(due.map((d) => [d.date, d.paid])).toEqual([
      ['2026-09-01', true],
      ['2026-10-01', false],
    ]);
  });
});
