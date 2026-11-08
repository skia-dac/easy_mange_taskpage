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
      // « Ajouter 500 FCFA · Nourriture » (nouvelle) ou « Enregistrer … » (modification).
      if (/^(Ajouter|Enregistrer)/.test(props.label)) {
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
    // (« Enregistrer » ou « Enregistrer 1 500 FCFA · Nourriture » : aucun des deux.)
    expect(screen.queryByText(/Enregistrer|Ajouter/)).toBeNull();
    expect(screen.queryByText(i18n.t('money.delete'))).toBeNull();
    await act(async () => release?.());
    for (let i = 0; i < 5; i++) await flush();
    // Chargée : le formulaire est en mode modification, avec la note, le montant, la catégorie et
    // la date (hier) de l'opération.
    expect(await screen.findByDisplayValue('Déjeuner')).toBeTruthy();
    expect(screen.getByText(i18n.t('money.delete'))).toBeTruthy();
    expect(screen.getByLabelText('Montant : 1 500 FCFA')).toBeTruthy();
    expect(screen.getByText('Enregistrer 1 500 FCFA · Nourriture')).toBeTruthy();
    expect(screen.getByTestId('category-food').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('date-yesterday').props.accessibilityState).toMatchObject({
      checked: true,
    });
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
    expect(screen.queryByText(/Enregistrer|Ajouter/)).toBeNull();

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
    expect(screen.queryByText(/Enregistrer|Ajouter/)).toBeNull();
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

describe('saisie rapide', () => {
  let editedId: string | undefined;
  beforeEach(() => {
    editedId = mockParams.id;
    delete mockParams.id;
    mockParams.kind = 'expense';
    mockCreate.mockClear();
    jest.mocked(router.push).mockClear();
  });
  afterEach(() => {
    delete mockParams.kind;
    if (editedId) mockParams.id = editedId;
  });

  async function renderNew() {
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
  }
  const type = async (...keys: string[]) => {
    for (const k of keys) await fireEvent.press(screen.getByTestId(`pad-${k}`));
  };

  it('montant à 0 : « 0 » estompé et bouton désactivé, rien n’est enregistré', async () => {
    await renderNew();
    expect(screen.getByLabelText('Montant : 0 FCFA')).toBeTruthy();
    // La catégorie la plus utilisée (Nourriture, déjà notée) est choisie d'office.
    const button = screen.getByRole('button', { name: 'Ajouter · Nourriture' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    for (let i = 0; i < 3; i++) await flush();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('le montant tapé est groupé par milliers et résumé dans le bouton', async () => {
    await renderNew();
    await type('2', '5', '0', '0');
    expect(screen.getByText('2 500')).toBeTruthy();
    expect(screen.getByLabelText('Montant : 2 500 FCFA')).toBeTruthy();
    await type('000');
    expect(screen.getByText('2 500 000')).toBeTruthy();
    await type('back', 'back', 'back');
    const button = screen.getByRole('button', { name: 'Ajouter 2 500 FCFA · Nourriture' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: false });
    // FCFA sans décimales : pas de virgule, « Trois zéros » à la place.
    expect(screen.getByLabelText('Trois zéros')).toBeTruthy();
    expect(screen.queryByLabelText('Virgule')).toBeNull();
  });

  it('touche longue sur « Effacer » : tout le montant est effacé', async () => {
    await renderNew();
    await type('1', '2', '3');
    expect(screen.getByLabelText('Montant : 123 FCFA')).toBeTruthy();
    const erase = screen.getByLabelText('Effacer');
    expect(erase.props.accessibilityHint).toBe(i18n.t('money.eraseHint'));
    await fireEvent(erase, 'longPress');
    expect(screen.getByLabelText('Montant : 0 FCFA')).toBeTruthy();
    // Aussi par l'action du lecteur d'écran.
    await type('4');
    await fireEvent(erase, 'accessibilityAction', { nativeEvent: { actionName: 'clear' } });
    expect(screen.getByLabelText('Montant : 0 FCFA')).toBeTruthy();
  });

  it('« Tout voir » : toutes les catégories en entier, choix, et « Nouvelle catégorie »', async () => {
    await renderNew();
    // Sur la ligne : 7 catégories et « Tout voir », groupe de boutons radio.
    const quick = screen.getAllByTestId(/^category-(?!all|new)/);
    expect(quick).toHaveLength(7);
    expect(quick[0]!.props.testID).toBe('category-food');
    expect(screen.queryByTestId('category-supplies')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Voir les 16 catégories'));
    expect(screen.getByText('Choisir une catégorie')).toBeTruthy();
    // Noms complets, jamais coupés (« Fournitures, photocopies », « Internet, forfait »).
    const supplies = screen.getByTestId('sheet-category-supplies');
    expect(supplies.props.accessibilityRole).toBe('radio');
    expect(screen.getByText('Fournitures, photocopies')).toBeTruthy();
    expect(screen.getByText('Internet, forfait')).toBeTruthy();
    expect(screen.getAllByTestId(/^sheet-category-/)).toHaveLength(16);

    await fireEvent.press(supplies);
    for (let i = 0; i < 3; i++) await flush();
    // Choisie dans la liste : elle s'affiche en tête de la ligne, cochée.
    expect(screen.queryByText('Choisir une catégorie')).toBeNull();
    expect(screen.getByTestId('category-supplies').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('button', { name: 'Ajouter · Fournitures, photocopies' })).toBeTruthy();

    // « Nouvelle catégorie » ouvre l'écran de création une fois la fenêtre fermée.
    await fireEvent.press(screen.getByTestId('category-all'));
    await fireEvent.press(screen.getByTestId('category-new'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/money/category-form',
      params: { kind: 'expense' },
    });
  });

  it('date : « Aujourd’hui » par défaut, « Hier » en un appui ; note repliée', async () => {
    await renderNew();
    expect(screen.getByTestId('date-today').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByTestId('date-yesterday'));
    expect(screen.getByTestId('date-yesterday').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.queryByLabelText(i18n.t('money.note'))).toBeNull();
    await fireEvent.press(screen.getByText('Ajouter une note'));
    expect(screen.getByPlaceholderText(i18n.t('common.optional'))).toBeTruthy();
  });
});
