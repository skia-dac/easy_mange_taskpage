import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import SettingsScreen from '../settings';

let mockDb: Db & { close(): void };
const signedOut = { enabled: false, loading: false, session: null, userId: null, email: null };
let mockAuth: Record<string, unknown> = signedOut;
const mockSignOut = jest.fn(async () => undefined);
/** Ce qui reste à envoyer après chaque essai d'envoi (dans l'ordre). */
let mockLeft: number[] = [];
const mockPush = jest.fn(async () => mockLeft.shift() ?? 0);
const mockSignOutFromPhone = jest.fn(async () => undefined);
const mockWipe = jest.fn(async () => undefined);

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: { Screen: () => null },
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  useAuth: () => mockAuth,
  signOut: () => mockSignOut(),
}));
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
  listBackups: () => [],
}));
jest.mock('@/workflows', () => ({
  ...jest.requireActual('@/workflows'),
  pushBeforeErase: (...args: unknown[]) => mockPush(...(args as [])),
  signOutFromPhone: (...args: unknown[]) => mockSignOutFromPhone(...(args as [])),
  wipeAllData: (...args: unknown[]) => mockWipe(...(args as [])),
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(() => {
  mockAuth = signedOut;
  mockLeft = [];
  [mockSignOut, mockPush, mockSignOutFromPhone, mockWipe].forEach((m) => m.mockClear());
  jest.mocked(router.replace).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

/**
 * Répond aux boîtes successives : pour chacune, le texte du bouton à toucher. Garde les titres
 * et messages montrés, pour vérifier ce que l'utilisateur a lu.
 */
function answer(choices: string[]) {
  const shown: { title: string; message?: string }[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons?: AlertButton[]) => {
    shown.push({ title, message });
    const choice = choices.shift();
    buttons?.find((b) => b.text === choice)?.onPress?.();
  });
  return shown;
}

async function pressWipe() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <SettingsScreen />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: i18n.t('data.wipe') }));
  await flush();
}

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const signedIn = { ...signedOut, enabled: true, userId: 'user-1', email: 'a@b.c' };

describe('Réglages › Supprimer toutes mes données (même parcours que Compte › Effacer ce téléphone)', () => {
  it('connecté : une confirmation, envoie d’abord, propose de réessayer, puis efface et déconnecte', async () => {
    mockAuth = signedIn;
    mockLeft = [2, 0];
    const shown = answer([t('account.eraseConfirm'), t('account.unsyncedRetry')]);
    await pressWipe();
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(shown.map((s) => s.title)).toEqual([
      t('account.eraseTitle'),
      t('account.unsyncedTitle'),
    ]);
    expect(shown[0]?.message).toBe(t('account.eraseMessage'));
    expect(shown[1]?.message).toBe(t('account.unsyncedMessage', { count: 2 }));
    expect(mockSignOutFromPhone).toHaveBeenCalledWith(mockDb, false, { discardUnsynced: false });
    expect(mockWipe).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });

  it('connecté : « Annuler » devant les modifications non envoyées n’efface rien', async () => {
    mockAuth = signedIn;
    mockLeft = [3];
    answer([t('account.eraseConfirm'), t('common.cancel')]);
    await pressWipe();
    expect(mockSignOutFromPhone).not.toHaveBeenCalled();
    expect(mockWipe).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('connecté : « Effacer quand même » l’accepte explicitement, sans autre question', async () => {
    mockAuth = signedIn;
    mockLeft = [1];
    const shown = answer([t('account.eraseConfirm'), t('account.unsyncedErase')]);
    await pressWipe();
    expect(shown).toHaveLength(2);
    expect(mockSignOutFromPhone).toHaveBeenCalledWith(mockDb, false, { discardUnsynced: true });
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });

  it('connecté : tout envoyé, une seule question ; la confirmation refusée n’envoie ni n’efface rien', async () => {
    mockAuth = signedIn;
    mockLeft = [0];
    const shown = answer([t('common.cancel')]);
    await pressWipe();
    expect(shown).toHaveLength(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockSignOutFromPhone).not.toHaveBeenCalled();
  });

  it('sans compte : une confirmation, aucun envoi, efface puis déconnecte par précaution', async () => {
    const shown = answer([t('data.wipeConfirm')]);
    await pressWipe();
    expect(shown.map((s) => s.title)).toEqual([t('data.wipeTitle')]);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockWipe).toHaveBeenCalledWith(mockDb);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });

  it('le message dit ce que deviennent le compte et les modifications non envoyées', () => {
    expect(t('account.eraseMessage')).toMatch(/compte/);
    expect(t('account.eraseMessage')).toMatch(/pas encore envoyé/);
  });
});
