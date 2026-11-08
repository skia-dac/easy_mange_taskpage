import type { DueItem, Recurring } from '@/modules/finance';

import { groupDue, moneyHero, periodLabel, periodTense } from './money';

const recurring = (id: string, name: string, extra: Partial<Recurring> = {}): Recurring => ({
  id,
  kind: 'charge',
  name,
  categoryId: null,
  amountMinor: 5000,
  currency: 'XAF',
  frequency: 'monthly',
  dayOfMonth: 1,
  weekday: 6,
  time: null,
  reminders: [],
  startDate: '2026-01-01',
  endDate: null,
  active: true,
  payoutDate: null,
  payoutMinor: null,
  payoutAuto: true,
  note: null,
  payoutRecorded: false,
  ...extra,
});

const due = (r: Recurring, date: string, paid = false): DueItem => ({
  recurring: r,
  date,
  amountMinor: r.amountMinor,
  paid,
  transactionId: paid ? `tx-${r.id}-${date}` : null,
});

const tontine = recurring('t', 'Tontine des amis de la fac', {
  kind: 'tontine',
  frequency: 'weekly',
});
const rent = recurring('r', 'Loyer', { amountMinor: 45000, dayOfMonth: 5 });
const water = recurring('w', 'Eau', { amountMinor: 3000, dayOfMonth: 20 });

describe('« À payer » : une ligne par charge fixe ou tontine', () => {
  const january = ['2027-01-02', '2027-01-09', '2027-01-16', '2027-01-23', '2027-01-30'];

  it('regroupe les 5 cotisations d’une tontine hebdomadaire en une seule ligne', () => {
    const groups = groupDue(
      [...january.map((d) => due(tontine, d)), due(rent, '2027-01-05')],
      '2027-01-01',
    );
    expect(groups.map((g) => g.recurring.name)).toEqual(['Tontine des amis de la fac', 'Loyer']);
    const [t] = groups;
    expect(t).toMatchObject({
      count: 5,
      paidCount: 0,
      totalMinor: 25000,
      unpaidMinor: 25000,
      late: false,
    });
    expect(t?.next?.date).toBe('2027-01-02');
    expect(t?.lastPaid).toBeNull();
  });

  it('la case paie la prochaine échéance impayée ; décoche la dernière payée quand tout est payé', () => {
    const [partial] = groupDue(
      [due(tontine, january[0]!, true), due(tontine, january[1]!, true), due(tontine, january[2]!)],
      '2027-01-12',
    );
    expect(partial?.next?.date).toBe('2027-01-16');
    expect(partial?.paidCount).toBe(2);
    expect(partial?.unpaidMinor).toBe(5000);
    expect(partial?.late).toBe(false);

    const [done] = groupDue(
      [due(tontine, january[1]!, true), due(tontine, january[0]!, true)],
      '2027-01-12',
    );
    expect(done?.next).toBeNull();
    expect(done?.lastPaid?.date).toBe('2027-01-09');
  });

  it('en retard d’abord, puis par prochaine date, et les lignes payées à la fin', () => {
    const groups = groupDue(
      [
        due(rent, '2027-01-05', true),
        due(water, '2027-01-20'),
        due(tontine, '2026-12-26'), // retard de la période d'avant
        due(tontine, '2027-01-02'),
        due(recurring('i', 'Internet', { dayOfMonth: 15 }), '2027-01-15'),
      ],
      '2027-01-10',
    );
    expect(groups.map((g) => [g.recurring.name, g.late])).toEqual([
      ['Tontine des amis de la fac', true],
      ['Internet', false],
      ['Eau', false],
      ['Loyer', false],
    ]);
    expect(groups[0]?.next?.date).toBe('2026-12-26');
  });

  it('aucune échéance : aucune ligne', () => {
    expect(groupDue([], '2027-01-10')).toEqual([]);
  });
});

describe('carte principale : solde, découvert et barre', () => {
  const range = { from: '2027-01-01', to: '2027-01-31' };

  it('temps de la période : en cours, terminée, à venir', () => {
    expect(periodTense(range, '2027-01-15')).toBe('current');
    expect(periodTense(range, '2027-02-01')).toBe('past');
    expect(periodTense(range, '2026-11-08')).toBe('future');
  });

  it('solde positif : barre de ce qui reste sur l’argent disponible', () => {
    const hero = moneyHero(
      { range, balance: 30000, income: 80000, carryOver: 20000 },
      '2027-01-15',
    );
    expect(hero).toEqual({
      tense: 'current',
      deficitMinor: 0,
      bar: { leftPercent: 30, availableMinor: 100000 },
      carryOverMinor: 20000,
    });
  });

  it('découvert : montant à afficher, pas de barre', () => {
    const hero = moneyHero({ range, balance: -24000, income: 0, carryOver: -24000 }, '2027-01-15');
    expect(hero.deficitMinor).toBe(24000);
    expect(hero.bar).toBeNull();
    expect(hero.carryOverMinor).toBe(-24000);
  });

  it('pas d’entrée ni de report positif : pas de barre (elle ne voudrait rien dire)', () => {
    expect(moneyHero({ range, balance: 0, income: 0, carryOver: 0 }, '2027-01-15').bar).toBeNull();
  });

  it('période à venir : pas de barre ; report nul : ligne cachée', () => {
    const hero = moneyHero({ range, balance: 5000, income: 5000, carryOver: 0 }, '2026-11-08');
    expect(hero.tense).toBe('future');
    expect(hero.bar).toBeNull();
    expect(hero.carryOverMinor).toBeNull();
  });

  it('plus d’argent que les entrées (remboursement reçu) : la barre reste pleine, pas plus', () => {
    const hero = moneyHero({ range, balance: 12000, income: 10000, carryOver: 0 }, '2027-01-15');
    expect(hero.bar?.leftPercent).toBe(100);
  });
});

describe('libellé de la période', () => {
  const month = { kind: 'month', startDay: 1 } as const;

  it('mois qui commence le 1er : « Janvier 2027 »', () => {
    expect(periodLabel({ from: '2027-01-01', to: '2027-01-31' }, month, 'fr', '2026-11-08')).toBe(
      'Janvier 2027',
    );
    expect(periodLabel({ from: '2027-01-01', to: '2027-01-31' }, month, 'en', '2026-11-08')).toBe(
      'January 2027',
    );
  });

  it('mois décalé : « 25 oct. – 24 nov. », l’année seulement hors de l’année en cours', () => {
    const shifted = { kind: 'month', startDay: 25 } as const;
    expect(periodLabel({ from: '2026-10-25', to: '2026-11-24' }, shifted, 'fr', '2026-11-08')).toBe(
      '25 oct. – 24 nov.',
    );
    expect(periodLabel({ from: '2026-12-25', to: '2027-01-24' }, shifted, 'fr', '2026-11-08')).toBe(
      '25 déc. 2026 – 24 janv. 2027',
    );
    expect(periodLabel({ from: '2027-01-25', to: '2027-02-24' }, shifted, 'fr', '2026-11-08')).toBe(
      '25 janv. – 24 févr. 2027',
    );
  });

  it('semaine : « 2 nov. – 8 nov. »', () => {
    const week = { kind: 'week', startWeekday: 1 } as const;
    expect(periodLabel({ from: '2026-11-02', to: '2026-11-08' }, week, 'fr', '2026-11-08')).toBe(
      '2 nov. – 8 nov.',
    );
  });
});
