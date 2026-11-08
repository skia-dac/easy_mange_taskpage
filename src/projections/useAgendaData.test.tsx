import { act, renderHook } from '@testing-library/react-native';

import { createTransaction } from '@/modules/finance';
import { createWorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import { agendaWindow, useAgendaData } from './useAgendaData';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

// Les lectures de l'agenda sont espionnées pour compter qui est relu après une écriture.
jest.mock('@/modules/productivity', () => {
  const actual =
    jest.requireActual<typeof import('@/modules/productivity')>('@/modules/productivity');
  return {
    ...actual,
    listWorkItemsSince: jest.fn(actual.listWorkItemsSince),
    listHabits: jest.fn(actual.listHabits),
    listSlots: jest.fn(actual.listSlots),
  };
});
jest.mock('@/modules/academic', () => {
  const actual = jest.requireActual<typeof import('@/modules/academic')>('@/modules/academic');
  return { ...actual, listCourseSeries: jest.fn(actual.listCourseSeries) };
});
jest.mock('@/modules/finance', () => {
  const actual = jest.requireActual<typeof import('@/modules/finance')>('@/modules/finance');
  return { ...actual, listTransactions: jest.fn(actual.listTransactions) };
});

const productivity = jest.requireMock<Record<string, jest.Mock>>('@/modules/productivity');
const academic = jest.requireMock<Record<string, jest.Mock>>('@/modules/academic');
const finance = jest.requireMock<Record<string, jest.Mock>>('@/modules/finance');

// Quelques tours de boucle : les lectures SQLite de test sont des promesses enchaînées.
const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

const counts = () => ({
  work: productivity.listWorkItemsSince!.mock.calls.length,
  habits: productivity.listHabits!.mock.calls.length,
  slots: productivity.listSlots!.mock.calls.length,
  courses: academic.listCourseSeries!.mock.calls.length,
  money: finance.listTransactions!.mock.calls.length,
});

beforeEach(async () => {
  mockDb = await createTestDb();
  jest.clearAllMocks();
});
afterEach(() => mockDb.close());

describe('useAgendaData', () => {
  it('une dépense ne relit que l’argent ; une tâche ne relit que les tâches', async () => {
    const h = await renderHook(() => useAgendaData());
    await flush();
    expect(h.result.current.data).toBeDefined();
    const start = counts();
    // Les tâches et devoirs sont lus une fois chacun ; le reste une fois.
    expect(start).toEqual({ work: 2, habits: 1, slots: 1, courses: 1, money: 1 });

    const today = new Date().toISOString().slice(0, 10);
    await act(async () => {
      await createTransaction(mockDb, {
        kind: 'expense',
        amountMinor: 1500,
        currency: 'XAF',
        date: today,
        categoryId: 'food',
      });
    });
    await flush();
    expect(counts()).toEqual({ ...start, money: start.money + 1 });

    await act(async () => {
      await createWorkItem(mockDb, 'task', {
        title: 'Réviser',
        dueDate: today,
        priority: 'normal',
        status: 'todo',
      });
    });
    await flush();
    expect(counts()).toEqual({ ...start, money: start.money + 1, work: start.work + 2 });
    expect(h.result.current.data?.work.map((w) => w.title)).toEqual(['Réviser']);
    await h.unmount();
  });

  it('la période lue suit le mois et s’élargit pour couvrir les jours affichés', () => {
    expect(agendaWindow('2026-11-07')).toEqual({ from: '2026-09-01', to: '2027-11-30' });
    // Même clé tout le mois.
    expect(agendaWindow('2026-11-30')).toEqual(agendaWindow('2026-11-01'));
    expect(agendaWindow('2026-01-15')).toEqual({ from: '2025-11-01', to: '2027-01-31' });
    expect(agendaWindow('2026-11-07', { from: '2026-03-30', to: '2026-04-05' })).toEqual({
      from: '2026-03-01',
      to: '2027-11-30',
    });
    expect(agendaWindow('2026-11-07', { from: '2028-02-01', to: '2028-02-07' }).to).toBe(
      '2028-02-29',
    );
  });
});
