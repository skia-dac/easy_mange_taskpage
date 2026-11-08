import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import type { ComponentType } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  createCategory,
  createTransaction,
  getCategory,
  getTransaction,
  listCategories,
} from '@/modules/finance';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import MoneyCategoryFormScreen from '../money/category-form';
import MoneySettingsScreen from '../money/settings';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = {};

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
jest.useFakeTimers({ now: new Date(2026, 10, 8, 10, 0) });

const prevent = jest.mocked(usePreventRemove);
/** La garde « Abandonner les modifications ? » est-elle active ? */
const guarded = () => prevent.mock.calls.at(-1)?.[0];

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(() => {
  prevent.mockClear();
  jest.mocked(router.back).mockClear();
  jest.mocked(router.push).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const flush = () => act(async () => {});

async function show(Screen: ComponentType) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <Screen />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
}

describe('nouvelle catégorie d’argent', () => {
  it('une idée remplit nom, icône et couleur ; l’aperçu suit ; enregistrer crée la catégorie', async () => {
    mockParams = {};
    await show(MoneyCategoryFormScreen);
    // Rien de saisi : pas de garde, aperçu « Ta catégorie ».
    expect(guarded()).toBe(false);
    expect(screen.getByText('Ta catégorie')).toBeTruthy();
    // Idées propres au Cameroun ; aucune ne reprend une catégorie de l'app (« Tontine »).
    expect(screen.getByText('Crédit téléphone')).toBeTruthy();
    expect(screen.queryByText('Tontine')).toBeNull();

    await fireEvent.press(screen.getByText('Taxi / moto'));
    await flush();
    expect(screen.getByDisplayValue('Taxi / moto')).toBeTruthy();
    expect(guarded()).toBe(true);
    // L'icône et la couleur de l'idée sont choisies (radio coché, libellé humain).
    expect(screen.getByTestId('icon-navigation').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('icon-navigation').props.accessibilityLabel).toBe('Transport');
    expect(screen.getByTestId('color-amber').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(
      screen.getByLabelText('Aperçu : Taxi / moto, Dépense, icône Transport, couleur Ambre'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByText('Ajouter la catégorie'));
    await flush();
    const saved = (await listCategories(mockDb)).find((c) => c.name === 'Taxi / moto');
    expect(saved).toMatchObject({ kind: 'expense', icon: 'navigation', colorId: 'amber' });
    expect(router.back).toHaveBeenCalledTimes(1);

    // Idée déjà utilisée : elle n'est plus proposée.
    await show(MoneyCategoryFormScreen);
    expect(screen.queryByText('Taxi / moto')).toBeNull();
  });

  it('?kind=income : idées d’entrées, et le nom vide reste refusé sous le champ', async () => {
    mockParams = { kind: 'income' };
    await show(MoneyCategoryFormScreen);
    expect(screen.getByText('Salaire')).toBeTruthy();
    expect(screen.queryByText('Crédit téléphone')).toBeNull();
    await fireEvent.press(screen.getByTestId('icon-briefcase'));
    await fireEvent.press(screen.getByText('Ajouter la catégorie'));
    await flush();
    expect(screen.getByText(i18n.t('validation.required'))).toBeTruthy();
    expect(router.back).not.toHaveBeenCalled();
  });
});

describe('modifier une catégorie d’argent', () => {
  it('charge la catégorie : ses valeurs, sans type ni idées, garde au repos', async () => {
    const id = await createCategory(mockDb, {
      kind: 'expense',
      name: 'Coiffeur',
      icon: 'scissors',
      colorId: 'pink',
    });
    mockParams = { id };
    await show(MoneyCategoryFormScreen);
    expect(screen.getByDisplayValue('Coiffeur')).toBeTruthy();
    expect(screen.getByTestId('icon-scissors').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByTestId('color-pink').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.queryByText('Idées')).toBeNull();
    expect(screen.queryByText('Entrée')).toBeNull();
    expect(guarded()).toBe(false);

    await fireEvent.press(screen.getByTestId('color-blue'));
    expect(guarded()).toBe(true);
    await fireEvent.press(screen.getByText('Enregistrer la catégorie'));
    await flush();
    expect(await getCategory(mockDb, id)).toMatchObject({ name: 'Coiffeur', colorId: 'blue' });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('catégorie supprimée ailleurs : « introuvable », pas de formulaire', async () => {
    mockParams = { id: 'disparue' };
    await show(MoneyCategoryFormScreen);
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
    expect(screen.queryByText('Enregistrer la catégorie')).toBeNull();
  });

  it('supprimer demande confirmation ; ses opérations passent dans « Autre »', async () => {
    const id = await createCategory(mockDb, {
      kind: 'expense',
      name: 'Gaz',
      icon: 'zap',
      colorId: 'red',
    });
    const tx = await createTransaction(mockDb, {
      kind: 'expense',
      amountMinor: 6500,
      currency: 'XAF',
      date: '2026-11-07',
      categoryId: id,
      note: null,
    });
    mockParams = { id };
    await show(MoneyCategoryFormScreen);
    // L'effet de la suppression est dit avant de toucher le bouton.
    expect(screen.getByText('Ses opérations restent, rangées dans « Autre ».')).toBeTruthy();

    // Annuler : rien ne change.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await fireEvent.press(screen.getByText('Supprimer la catégorie'));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      'Supprimer « Gaz » ?',
      'Ses opérations restent, rangées dans « Autre ».',
      expect.any(Array),
      expect.anything(),
    );
    expect(await getCategory(mockDb, id)).not.toBeNull();

    alert.mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByText('Supprimer la catégorie'));
    await flush();
    expect(await getCategory(mockDb, id)).toBeNull();
    expect((await getTransaction(mockDb, tx))?.categoryId).toBe('other');
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('Réglages de l’argent › Mes catégories', () => {
  it('chaque ligne ouvre la fiche ; « Nouvelle catégorie » ouvre la création ; pas de corbeille', async () => {
    mockParams = {};
    const income = await createCategory(mockDb, {
      kind: 'income',
      name: 'Cours du soir',
      icon: 'book',
      colorId: 'violet',
    });
    await show(MoneySettingsScreen);
    expect(screen.getByText('Dépenses')).toBeTruthy();
    expect(screen.getByText('Entrées')).toBeTruthy();
    // Le formulaire n'est plus dans les réglages : ni champ « Nom », ni bouton « Supprimer ».
    expect(screen.queryByText('Ajouter la catégorie')).toBeNull();
    expect(screen.queryByLabelText('Supprimer')).toBeNull();

    await fireEvent.press(screen.getByText('Cours du soir'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/money/category-form',
      params: { id: income },
    });
    await fireEvent.press(screen.getByLabelText('Nouvelle catégorie'));
    expect(router.push).toHaveBeenLastCalledWith('/money/category-form');
  });
});
