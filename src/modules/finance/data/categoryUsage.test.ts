import { createTestDb } from '@/test/memoryDb';

import { createTransaction, deleteTransaction } from './commands';
import { categoryUsage } from './queries';

describe('catégories les plus utilisées', () => {
  it('compte les opérations par catégorie et par type, la plus récente d’abord à égalité', async () => {
    const db = await createTestDb();
    const add = (kind: 'expense' | 'income', categoryId: string | null, date: string) =>
      createTransaction(db, { kind, amountMinor: 500, currency: 'XAF', date, categoryId });
    await add('expense', 'transport', '2026-09-01');
    await add('expense', 'transport', '2026-09-02');
    await add('expense', 'transport', '2026-09-03');
    await add('expense', 'food', '2026-09-04');
    await add('expense', 'internet', '2026-09-10');
    await add('expense', null, '2026-09-10');
    await add('income', 'grant', '2026-09-05');
    // Une opération supprimée ne compte plus.
    await deleteTransaction(db, await add('expense', 'food', '2026-09-20'));

    expect(await categoryUsage(db, 'expense')).toEqual([
      { categoryId: 'transport', uses: 3, lastDate: '2026-09-03' },
      { categoryId: 'internet', uses: 1, lastDate: '2026-09-10' },
      { categoryId: 'food', uses: 1, lastDate: '2026-09-04' },
    ]);
    expect(await categoryUsage(db, 'income')).toEqual([
      { categoryId: 'grant', uses: 1, lastDate: '2026-09-05' },
    ]);
    // Depuis une date : seules les opérations récentes comptent.
    expect(await categoryUsage(db, 'expense', '2026-09-03')).toEqual([
      { categoryId: 'internet', uses: 1, lastDate: '2026-09-10' },
      { categoryId: 'food', uses: 1, lastDate: '2026-09-04' },
      { categoryId: 'transport', uses: 1, lastDate: '2026-09-03' },
    ]);
    db.close();
  });
});
