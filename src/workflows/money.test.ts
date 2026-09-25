import {
  balanceBefore,
  createCategory,
  createGoal,
  createLoan,
  createRecurring,
  createTransaction,
  deleteCategory,
  deleteGoal,
  getMoneyPrefs,
  listCategories,
  listGoals,
  listLinkedTransactions,
  listLoans,
  listRecurring,
  listTransactions,
  payDue,
  periodContaining,
  recordDuePayouts,
  setMoneyPrefs,
  unpayDue,
  updateRecurring,
} from '@/modules/finance';
import { moneyOverview } from '@/projections';
import type { Db } from '@/shared/db';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const XAF = 'XAF';
const tx = (
  kind: 'expense' | 'income',
  amountMinor: number,
  date: string,
  categoryId: string,
  note?: string,
) => createTransaction(db, { kind, amountMinor, currency: XAF, date, categoryId, note });

async function overview(today: string) {
  const prefs = await getMoneyPrefs(db);
  const range = periodContaining(today, prefs.period);
  return moneyOverview({
    today,
    currency: prefs.currency,
    period: prefs.period,
    range,
    transactions: await listTransactions(db, { from: '2026-07-01', to: range.to }),
    balanceBeforeRange: await balanceBefore(db, range.from, prefs.currency),
    recurring: await listRecurring(db),
    goals: await listGoals(db),
    loans: await listLoans(db),
    linked: await listLinkedTransactions(db),
    categories: await listCategories(db),
  });
}

describe('module Argent', () => {
  it('ce qui reste, après les charges fixes, et par jour', async () => {
    await setMoneyPrefs(db, {
      currency: XAF,
      period: { kind: 'month', startDay: 25 },
      hideWidgetAmounts: false,
    });
    await tx('income', 10000, '2026-09-20', 'job'); // période précédente : reporté
    await tx('income', 200000, '2026-09-25', 'family_in');
    await tx('expense', 1500, '2026-09-25', 'food', 'Déjeuner');
    await tx('expense', 1000, '2026-09-25', 'transport');
    const rent = await createRecurring(db, {
      kind: 'charge',
      name: 'Loyer',
      categoryId: 'home',
      amountMinor: 35000,
      currency: XAF,
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-09-01',
      reminders: [1440],
    });
    const o = await overview('2026-09-25');
    expect(o.range).toEqual({ from: '2026-09-25', to: '2026-10-24' });
    expect(o.carryOver).toBe(10000);
    expect(o.balance).toBe(207500);
    expect(o.todaySpent).toBe(2500);
    expect(o.unpaidTotal).toBe(35000);
    expect(o.afterCharges).toBe(172500);
    expect(o.perDay).toBe(Math.floor(172500 / 30));
    expect(o.byCategory.map((c) => c.categoryId)).toEqual(['food', 'transport']);

    // Payer le loyer : il devient une dépense, l'échéance est « payée », et ça s'annule.
    await payDue(db, rent, '2026-10-01', '2026-09-30');
    const paid = await overview('2026-09-30');
    expect(paid.unpaidTotal).toBe(0);
    expect(paid.balance).toBe(172500);
    await unpayDue(db, rent, '2026-10-01');
    expect((await overview('2026-09-30')).unpaidTotal).toBe(35000);
  });

  it('le tour de tontine compte une seule fois comme entrée, et redevient comptable à une nouvelle date', async () => {
    const id = await createRecurring(db, {
      kind: 'tontine',
      name: 'Tontine du quartier',
      amountMinor: 5000,
      currency: XAF,
      frequency: 'weekly',
      weekday: 6,
      time: '15:00',
      reminders: [1440, 180],
      startDate: '2026-09-01',
      payoutDate: '2026-09-26',
      payoutMinor: 60000,
    });
    expect(await recordDuePayouts(db, '2026-09-25')).toBe(0);
    expect(await recordDuePayouts(db, '2026-09-26')).toBe(1);
    expect(await recordDuePayouts(db, '2026-09-27')).toBe(0);
    const incomes = (await listTransactions(db)).filter((t) => t.kind === 'income');
    expect(incomes.map((t) => [t.amountMinor, t.categoryId, t.date])).toEqual([
      [60000, 'tontine_in', '2026-09-26'],
    ]);
    const [r] = await listRecurring(db);
    await updateRecurring(db, id, { ...r!, payoutDate: '2027-03-06' });
    expect((await listRecurring(db))[0]?.payoutRecorded).toBe(false);
    // « Compter automatiquement » désactivé : rien n'est ajouté.
    await updateRecurring(db, id, { ...r!, payoutDate: '2026-09-27', payoutAuto: false });
    expect(await recordDuePayouts(db, '2026-09-28')).toBe(0);
  });

  it('épargne et prêts : soldes, et ce qui reste en tient compte', async () => {
    await tx('income', 100000, '2026-09-02', 'family_in');
    const goal = await createGoal(db, { name: 'Téléphone', targetMinor: 150000, currency: XAF });
    await createTransaction(db, {
      kind: 'saving',
      amountMinor: 20000,
      currency: XAF,
      date: '2026-09-03',
      goalId: goal,
    });
    const loan = await createLoan(
      db,
      { direction: 'lent', person: 'Kevin' },
      { amountMinor: 10000, currency: XAF, date: '2026-09-04' },
    );
    await createTransaction(db, {
      kind: 'lend_back',
      amountMinor: 4000,
      currency: XAF,
      date: '2026-09-10',
      loanId: loan,
    });
    const o = await overview('2026-09-15');
    expect(o.balance).toBe(100000 - 20000 - 10000 + 4000);
    expect(o.saved).toBe(20000);
    expect(o.lent).toBe(6000);
    expect(o.goals.map((g) => g.savedMinor)).toEqual([20000]);
    expect(o.loans.map((l) => [l.loan.person, l.outstandingMinor, l.totalMinor])).toEqual([
      ['Kevin', 6000, 10000],
    ]);
    await deleteGoal(db, goal);
    expect((await overview('2026-09-15')).balance).toBe(94000);
  });

  it('catégorie personnelle : supprimée, ses opérations passent dans « Autre »', async () => {
    const cat = await createCategory(db, { kind: 'expense', name: 'Coiffeur', icon: 'scissors' });
    await tx('expense', 2000, '2026-09-10', cat);
    await deleteCategory(db, cat);
    expect((await listTransactions(db))[0]?.categoryId).toBe('other');
    expect(await listCategories(db)).toEqual([]);
  });

  it('refuse un montant nul et trop de rappels', async () => {
    await expect(tx('expense', 0, '2026-09-10', 'food')).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createRecurring(db, {
        kind: 'charge',
        name: 'Internet',
        amountMinor: 10000,
        currency: XAF,
        frequency: 'monthly',
        startDate: '2026-09-01',
        reminders: [10, 60, 180, 1440],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('propose une charge fixe pour une dépense qui revient', async () => {
    for (const d of ['2026-09-02', '2026-09-09', '2026-09-16'])
      await tx('expense', 2000, d, 'supplies', 'Photocopies');
    const o = await overview('2026-09-20');
    expect(o.insights).toContainEqual({
      kind: 'repeating',
      categoryId: 'supplies',
      note: 'Photocopies',
      count: 3,
      averageMinor: 2000,
    });
  });
});
