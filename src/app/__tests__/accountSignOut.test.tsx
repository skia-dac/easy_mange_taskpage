import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { CHOICE_IOS_FALLBACK_MS } from '@/shared/ui/ChoiceSheet';
import { createTestDb } from '@/test/memoryDb';

import AccountScreen from '../account';

let mockDb: Db & { close(): void };
const mockAuth = {
  enabled: true,
  loading: false,
  session: null,
  userId: 'user-1',
  email: 'a@b.c',
};
let mockLeft: number[] = [];
const mockPush = jest.fn(async () => mockLeft.shift() ?? 0);
const mockSignOutFromPhone = jest.fn(async () => undefined);
const mockToast = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: { Screen: () => null },
  };
});
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  useAuth: () => mockAuth,
}));
jest.mock('@/workflows', () => ({
  ...jest.requireActual('@/workflows'),
  pushBeforeErase: (...args: unknown[]) => mockPush(...(args as [])),
  signOutFromPhone: (...args: unknown[]) => mockSignOutFromPhone(...(args as [])),
}));
jest.mock('@/shared/ui', () => ({
  ...jest.requireActual('@/shared/ui'),
  showToast: (...args: unknown[]) => mockToast(...args),
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(() => {
  mockLeft = [];
  [mockPush, mockSignOutFromPhone, mockToast].forEach((m) => m.mockClear());
  jest.mocked(router.replace).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => {});
};

function answer(choices: string[]) {
  const shown: { title: string; message?: string }[] = [];
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons?: AlertButton[]) => {
    shown.push({ title, message });
    const choice = choices.shift();
    buttons?.find((b) => b.text === choice)?.onPress?.();
  });
  return shown;
}

async function openSignOut() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <AccountScreen />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
  await fireEvent.press(screen.getByRole('button', { name: t('account.signOut') }));
  await flush();
}

describe('Compte › Se déconnecter', () => {
  it('« Garder mes données » déconnecte tout de suite et le confirme par un message', async () => {
    await openSignOut();
    await fireEvent.press(screen.getByText(t('account.signOutKeep')));
    await flush();
    expect(mockSignOutFromPhone).toHaveBeenCalledWith(mockDb, true);
    expect(mockToast).toHaveBeenCalledWith(t('account.signedOutKept'));
  });

  it('« Effacer ce téléphone » : même parcours que les Réglages, après la fermeture du menu', async () => {
    mockLeft = [0];
    const shown = answer([t('account.eraseConfirm')]);
    await openSignOut();
    await fireEvent.press(screen.getByText(t('account.signOutErase')));
    // La confirmation attend la fin de la fermeture du menu.
    expect(shown).toHaveLength(0);
    await act(async () => {
      jest.advanceTimersByTime(CHOICE_IOS_FALLBACK_MS);
    });
    await flush();
    expect(shown.map((s) => s.title)).toEqual([t('account.eraseTitle')]);
    expect(shown[0]?.message).toBe(t('account.eraseMessage'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockSignOutFromPhone).toHaveBeenCalledWith(mockDb, false, { discardUnsynced: false });
    expect(router.replace).toHaveBeenCalledWith('/onboarding');
  });
});
