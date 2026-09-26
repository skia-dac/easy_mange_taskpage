import {
  getLoan,
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
  monthlyChargesTotal,
  payDue,
  periodContaining,
  recordDuePayouts,
  setLoanClosed,
  setMoneyPrefs,
  unpayDue,
  updateRecurring,
  updateTransaction,
} from '@/modules/finance';
import { moneyOverview, openLoans } from '@/projections';
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
      // Commence dans la période affichée : sans échéance antérieure restée impayée (voir #2).
      startDate: '2026-09-20',
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

  it('une charge impayée d’une période précédente reste « en retard » (#2)', async () => {
    await setMoneyPrefs(db, {
      currency: XAF,
      period: { kind: 'month', startDay: 1 },
      hideWidgetAmounts: false,
    });
    await tx('income', 100000, '2026-09-02', 'family_in');
    const rent = await createRecurring(db, {
      kind: 'charge',
      name: 'Loyer',
      categoryId: 'home',
      amountMinor: 35000,
      currency: XAF,
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-06-01',
      reminders: [],
    });
    // Juillet payé ; juin, août et septembre impayés → en octobre : 3 en retard + celle d'octobre.
    await payDue(db, rent, '2026-07-05');
    const o = await overview('2026-10-10');
    expect(o.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(o.due.map((d) => [d.date, d.paid])).toEqual([
      ['2026-08-05', false],
      ['2026-09-05', false],
      ['2026-10-05', false],
    ]);
    // Juin est au-delà des 3 périodes précédentes : oubliée.
    expect(o.unpaidTotal).toBe(3 * 35000);
    expect(o.afterCharges).toBe(o.balance - 3 * 35000);
    // Payer septembre depuis octobre : elle disparaît des retards.
    await payDue(db, rent, '2026-09-05', '2026-10-10');
    const paid = await overview('2026-10-10');
    expect(paid.due.filter((d) => !d.paid).map((d) => d.date)).toEqual([
      '2026-08-05',
      '2026-10-05',
    ]);
    // Une période passée (affichée pour consulter) ne remonte pas les retards des mois d'avant.
    const prefs = await getMoneyPrefs(db);
    const range = periodContaining('2026-09-10', prefs.period);
    const past = moneyOverview({
      today: '2026-10-10',
      currency: XAF,
      period: prefs.period,
      range,
      transactions: await listTransactions(db, { from: '2026-06-01', to: range.to }),
      balanceBeforeRange: 0,
      recurring: await listRecurring(db),
      goals: [],
      loans: [],
      linked: [],
      categories: [],
    });
    expect(past.due.map((d) => d.date)).toEqual(['2026-09-05']);
  });

  it('dé-payer puis « Annuler » recrée le paiement tel quel (#12)', async () => {
    const rent = await createRecurring(db, {
      kind: 'charge',
      name: 'Loyer',
      categoryId: 'home',
      amountMinor: 35000,
      currency: XAF,
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: '2026-09-01',
      reminders: [],
    });
    const id = await payDue(db, rent, '2026-10-01', '2026-09-28', 34000);
    const before = (await listTransactions(db)).find((t) => t.id === id)!;
    await unpayDue(db, rent, '2026-10-01');
    expect((await overview('2026-10-02')).due.find((d) => d.date === '2026-10-01')?.paid).toBe(
      false,
    );
    // Ce que fait le bouton « Annuler » de l'onglet Argent : même date, même montant.
    await payDue(db, rent, '2026-10-01', before.date, before.amountMinor);
    const again = (await listTransactions(db)).find((t) => t.recurringId === rent)!;
    expect([again.date, again.amountMinor]).toEqual(['2026-09-28', 34000]);
    expect((await overview('2026-10-02')).due.find((d) => d.date === '2026-10-01')?.paid).toBe(
      true,
    );
  });

  it('un remboursement ne peut pas dépasser le reste dû (#12)', async () => {
    const loan = await createLoan(
      db,
      { direction: 'lent', person: 'Kevin' },
      { amountMinor: 10000, currency: XAF, date: '2026-09-04' },
    );
    const back = (amountMinor: number) => ({
      kind: 'lend_back' as const,
      amountMinor,
      currency: XAF,
      date: '2026-09-10',
      loanId: loan,
    });
    await expect(createTransaction(db, back(12000))).rejects.toMatchObject({
      fields: { amountMinor: 'money.repayTooMuch' },
    });
    const id = await createTransaction(db, back(6000));
    // Modifier ce remboursement : il n'est pas compté contre lui-même (10 000 max), 11 000 refusé.
    await updateTransaction(db, id, back(10000));
    await expect(updateTransaction(db, id, back(11000))).rejects.toBeInstanceOf(ValidationError);
    expect((await overview('2026-09-15')).loans[0]?.outstandingMinor).toBe(0);
  });

  it('un prêt a la devise de son premier mouvement et n’apparaît que dans cette devise (#6)', async () => {
    const eur = await createLoan(
      db,
      { direction: 'lent', person: 'Léa' },
      { amountMinor: 5000, currency: 'EUR', date: '2026-09-04' },
    );
    const xaf = await createLoan(
      db,
      { direction: 'lent', person: 'Kevin' },
      { amountMinor: 10000, currency: XAF, date: '2026-09-04' },
    );
    expect((await getLoan(db, eur))?.currency).toBe('EUR');
    // En XAF : le prêt en euros n'est ni « réglé » ni compté, il est absent.
    const o = await overview('2026-09-15');
    expect(o.loans.map((l) => l.loan.id)).toEqual([xaf]);
    expect(openLoans(o.loans, 'lent').map((l) => l.loan.id)).toEqual([xaf]);
  });

  it('tuile « Prêts » et charges mensuelles : mêmes règles que leurs écrans (#12)', async () => {
    const kevin = await createLoan(
      db,
      { direction: 'lent', person: 'Kevin' },
      { amountMinor: 10000, currency: XAF, date: '2026-09-04' },
    );
    const closedLoan = await createLoan(
      db,
      { direction: 'lent', person: 'Awa' },
      { amountMinor: 5000, currency: XAF, date: '2026-09-04' },
    );
    await createLoan(
      db,
      { direction: 'borrowed', person: 'Papa' },
      { amountMinor: 7000, currency: XAF, date: '2026-09-04' },
    );
    await setLoanClosed(db, closedLoan, true);
    const o = await overview('2026-09-15');
    // Clôturé ou soldé : hors de la tuile, comme sur l'écran Prêts.
    expect(openLoans(o.loans, 'lent').map((l) => l.loan.id)).toEqual([kevin]);
    expect(openLoans(o.loans, 'borrowed').map((l) => l.loan.person)).toEqual(['Papa']);

    const charge = (name: string, currency: string, amountMinor: number, weekly = false) =>
      createRecurring(db, {
        kind: 'charge',
        name,
        categoryId: 'home',
        amountMinor,
        currency,
        ...(weekly
          ? { frequency: 'weekly' as const, weekday: 1 }
          : { frequency: 'monthly' as const, dayOfMonth: 1 }),
        startDate: '2026-09-01',
        reminders: [],
      });
    await charge('Loyer', XAF, 35000);
    await charge('Internet', XAF, 1000, true);
    await charge('Abonnement', 'EUR', 999);
    const all = await listRecurring(db);
    expect(monthlyChargesTotal(all, XAF)).toBe(35000 + Math.round((1000 * 52) / 12));
    expect(monthlyChargesTotal(all, 'EUR')).toBe(999);
  });
});
