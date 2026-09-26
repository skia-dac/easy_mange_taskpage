import { act, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createTransaction, listTransactions } from '@/modules/finance';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import MoneyAddScreen from '../money/add';

let mockDb: Db & { close(): void };
const mockParams: Record<string, string> = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: { Screen: () => null },
  };
});
// L'opération à modifier n'arrive que lorsqu'on libère la lecture (comme une base lente).
let release: (() => void) | null = null;
jest.mock('@/modules/finance', () => {
  const actual = jest.requireActual<typeof import('@/modules/finance')>('@/modules/finance');
  return {
    ...actual,
    getTransaction: (db: Db, id: string) =>
      new Promise<unknown>((resolve) => {
        release = () => resolve(actual.getTransaction(db, id));
      }),
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  mockParams.id = await createTransaction(mockDb, {
    kind: 'expense',
    amountMinor: 1500,
    currency: 'XAF',
    date: '2026-09-22',
    categoryId: 'food',
    note: 'Déjeuner',
  });
});
afterAll(() => mockDb.close());

const flush = () => act(async () => {});

describe('modifier une opération', () => {
  it('pas de bouton Enregistrer tant que l’opération n’est pas chargée (#12)', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <GestureHandlerRootView>
          <MoneyAddScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>,
    );
    // Avant le chargement : écran d'attente, aucun bouton qui créerait un doublon.
    // (« Enregistrer » ou « Enregistrer · Repas » : aucun des deux.)
    expect(screen.queryByText(/Enregistrer/)).toBeNull();
    expect(screen.queryByText(i18n.t('money.delete'))).toBeNull();
    await act(async () => release?.());
    for (let i = 0; i < 5; i++) await flush();
    // Chargée : le formulaire est en mode modification, avec la note existante.
    expect(await screen.findByDisplayValue('Déjeuner')).toBeTruthy();
    expect(screen.getByText(i18n.t('money.delete'))).toBeTruthy();
    expect(await listTransactions(mockDb)).toHaveLength(1);
  });
});
