import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getActiveSpaces, isOnboardingDone } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import OnboardingScreen from '../onboarding';

let mockDb: Db & { close(): void };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  useAuth: () => ({ enabled: false }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterEach(() => mockDb.close());

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
});
