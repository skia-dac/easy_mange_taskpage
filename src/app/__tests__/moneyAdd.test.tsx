import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
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
/** Lecture qui échoue (base illisible) : l'écran ne doit pas attendre sans fin. */
const mockRead = { fail: false };
/** Créations demandées par l'écran (la base de test refuserait une seconde en parallèle). */
const mockCreate = jest.fn();
jest.mock('@/modules/finance', () => {
  const actual = jest.requireActual<typeof import('@/modules/finance')>('@/modules/finance');
  return {
    ...actual,
    createTransaction: (...args: Parameters<typeof actual.createTransaction>) => {
      mockCreate();
      return actual.createTransaction(...args);
    },
    getTransaction: (db: Db, id: string) =>
      mockRead.fail
        ? Promise.reject(new Error('disk'))
        : new Promise<unknown>((resolve) => {
            release = () => resolve(actual.getTransaction(db, id));
          }),
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
// Le gestionnaire du bouton « Enregistrer », pour simuler deux appuis dans la même image.
const mockSavePress: { current?: (() => void) | null } = {};
jest.mock('@/shared/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('@/shared/ui')>('@/shared/ui');
  return {
    ...actual,
    Button: (props: React.ComponentProps<typeof actual.Button>) => {
      if (/Enregistrer/.test(props.label)) {
        const onPress = props.onPress;
        mockSavePress.current = onPress ? () => onPress({} as never) : null;
      }
      return React.createElement(actual.Button, props);
    },
  };
});
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

  it('lecture en échec : erreur et « Réessayer » (pas « n’existe plus »), aucun Enregistrer', async () => {
    mockRead.fail = true;
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
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
    for (let i = 0; i < 3; i++) await flush();
    // Une lecture ratée n'est pas une opération supprimée : on peut réessayer.
    expect(screen.getByText(i18n.t('state.itemErrorTitle'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('errors.itemNotFound'))).toBeNull();
    expect(screen.queryByText(/Enregistrer/)).toBeNull();

    // « Réessayer » : la lecture réussit, le formulaire apparaît avec l'opération.
    mockRead.fail = false;
    await fireEvent.press(screen.getByText('Réessayer'));
    await act(async () => release?.());
    for (let i = 0; i < 5; i++) await flush();
    expect(await screen.findByDisplayValue('Déjeuner')).toBeTruthy();
    expect(screen.getByText(i18n.t('money.delete'))).toBeTruthy();
    quiet.mockRestore();
  });

  it('opération supprimée entre-temps : « n’existe plus » avec « Retour »', async () => {
    const id = mockParams.id;
    mockParams.id = 'disparue';
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
    await act(async () => release?.());
    for (let i = 0; i < 3; i++) await flush();
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
    expect(screen.getByText('Retour')).toBeTruthy();
    expect(screen.queryByText(/Enregistrer/)).toBeNull();
    mockParams.id = id!;
  });
});

describe('nouvelle opération', () => {
  it('double appui sur « Enregistrer » : une seule opération, un seul retour', async () => {
    const editedId = mockParams.id;
    delete mockParams.id;
    const before = (await listTransactions(mockDb)).length;
    jest.mocked(router.back).mockClear();
    mockCreate.mockClear();
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
    for (let i = 0; i < 3; i++) await flush();
    await fireEvent.press(screen.getByLabelText('5'));
    await fireEvent.press(screen.getByLabelText('0'));
    await fireEvent.press(screen.getByLabelText('0'));
    const press = mockSavePress.current;
    expect(press).toBeTruthy();
    // Deux appuis dans la même image : `saving` n'est pas encore rendu entre les deux.
    await act(async () => {
      press?.();
      press?.();
    });
    for (let i = 0; i < 5; i++) await flush();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(await listTransactions(mockDb)).toHaveLength(before + 1);
    expect(router.back).toHaveBeenCalledTimes(1);
    if (editedId) mockParams.id = editedId;
  });
});
