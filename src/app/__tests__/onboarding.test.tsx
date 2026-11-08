import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getActiveSpaces, isOnboardingDone } from '@/modules/identity';
import { toIsoDate } from '@/shared/dates';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import OnboardingScreen from '../onboarding';

let mockDb: Db & { close(): void };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
const mockSave = { fail: 0 };
jest.mock('@/modules/identity', () => {
  const actual = jest.requireActual('@/modules/identity');
  return {
    ...actual,
    useAuth: () => ({ enabled: false }),
    // `mockSave.fail` : nombre d'enregistrements qui échouent avant de réussir.
    setOnboardingDone: (db: unknown) => {
      if (mockSave.fail > 0) {
        mockSave.fail -= 1;
        return Promise.reject(new Error('disk'));
      }
      return actual.setOnboardingDone(db);
    },
  };
});

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  jest.mocked(router.replace).mockClear();
  jest.mocked(router.push).mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  mockDb.close();
});

/** Va jusqu'à la dernière étape, en décochant Études si `withoutStudy`. */
async function toLastStep(withoutStudy = false) {
  await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
  if (withoutStudy) {
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Ma vie perso' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mes études' }));
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
  await flush();
}

const flush = () => act(async () => {});

async function show() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 568 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <OnboardingScreen />
    </SafeAreaProvider>,
  );
}

describe('première utilisation', () => {
  it('3 étapes au plus, chacune défile ; « Suivant » puis « Commencer »', async () => {
    await show();
    expect(screen.getByLabelText('Étape 1 sur 3')).toBeTruthy();
    expect(screen.getByText('Sache toujours ce qui t’attend')).toBeTruthy();
    expect(screen.getByText('Rien ne t’échappe')).toBeTruthy();
    // Pas de « Précédent » à la première étape.
    expect(screen.queryByRole('button', { name: 'Précédent' })).toBeNull();
    // Le contenu défile (petit écran, grand texte).
    expect(screen.getByTestId('onboarding-scroll')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByLabelText('Étape 2 sur 3')).toBeTruthy();
    expect(screen.getByText('Tu utilises MySky pour…')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    await flush();

    expect(screen.getByLabelText('Étape 3 sur 3')).toBeTruthy();
    expect(screen.getByTestId('onboarding-scroll')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Suivant' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer' }));
    await flush();
    expect(await isOnboardingDone(mockDb)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('« Précédent » revient à l’étape d’avant, sans perdre les espaces choisis', async () => {
    await show();
    await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Mon travail' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    await flush();
    expect(await getActiveSpaces(mockDb)).toEqual(['study', 'work']);

    await fireEvent.press(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByLabelText('Étape 2 sur 3')).toBeTruthy();
    expect(
      screen.getByRole('checkbox', { name: 'Mon travail' }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Précédent' }));
    expect(screen.getByLabelText('Étape 1 sur 3')).toBeTruthy();
  });

  it('« accueil terminé » pas enregistré : message et « Réessayer », jamais d’ouverture en boucle', async () => {
    mockSave.fail = 1;
    // 1er échec : « Annuler » → on reste sur l'étape, rien n'est ouvert.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await show();
    await toLastStep();
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer' }));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      'Enregistrer à nouveau\u00a0?',
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ text: 'Réessayer' })]),
      expect.any(Object),
    );
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Étape 3 sur 3')).toBeTruthy();

    // 2e essai : échec puis « Réessayer » qui réussit → l'app s'ouvre.
    alert.mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Réessayer')?.onPress?.();
    });
    mockSave.fail = 1;
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer' }));
    await flush();
    expect(await isOnboardingDone(mockDb)).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('dernière étape sans Études ni comptes : toujours un choix utile, une première tâche', async () => {
    await show();
    await toLastStep(true);
    expect(screen.queryByText('Ajouter mes matières')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Noter ma première tâche'));
    await flush();
    expect(await isOnboardingDone(mockDb)).toBe(true);
    // Datée d'aujourd'hui (jour local), sinon elle n'apparaît pas sur Aujourd'hui.
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/work/form',
      params: { date: toIsoDate(new Date()) },
    });
  });

  it('avec Études : le choix dit ce qu’il ouvre (les matières)', async () => {
    await show();
    await toLastStep();
    await fireEvent.press(screen.getByLabelText('Ajouter mes matières'));
    await flush();
    expect(router.push).toHaveBeenCalledWith('/subjects/form');
  });

  it('lecteur d’écran : chaque nouvelle étape part de son titre, les cartes lisent leur description', async () => {
    jest.useFakeTimers();
    const focus = jest
      .spyOn(AccessibilityInfo, 'sendAccessibilityEvent')
      .mockImplementation(() => {});
    await show();
    expect(focus).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    await act(async () => jest.advanceTimersByTime(200));
    expect(focus).toHaveBeenCalledTimes(1);
    const [node, event] = focus.mock.calls[0]!;
    expect(event).toBe('focus');
    expect((node as unknown as { props: { children: string } }).props.children).toBe(
      i18n.t('spaces.onboardingTitle'),
    );
    const study = screen.getByRole('checkbox', { name: i18n.t('spaces.name.study') });
    expect(study.props.accessibilityHint).toBe(i18n.t('spaces.hint.study'));
    jest.useRealTimers();
  });
});
