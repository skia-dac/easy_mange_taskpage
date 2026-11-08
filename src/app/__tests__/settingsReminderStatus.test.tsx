import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Alert, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { defaultNotificationPreferences, setNotificationPreferences } from '@/modules/identity';
import type { NotificationPermission } from '@/modules/platform';
import { writeAppSetting, type Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { createTestDb } from '@/test/memoryDb';

import SettingsScreen from '../settings';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = {};
const mockPermission = {
  state: 'undetermined' as NotificationPermission,
  ensure: jest.fn(async () => true),
};
/** Appels au pré-écran partagé (le vrai : snooze de 7 jours compris). */
const mockAsk = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: { Screen: () => null },
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
  listBackups: () => [],
}));
jest.mock('@/hooks/useNotificationPermission', () => {
  const actual = jest.requireActual('@/hooks/useNotificationPermission');
  return {
    ...actual,
    askNotificationPermission: (...args: Parameters<typeof actual.askNotificationPermission>) => {
      mockAsk(...args);
      return actual.askNotificationPermission(...args);
    },
  };
});
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};

async function show(Screen: ComponentType) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <SpacesContext.Provider value={spacesValue(['study', 'personal'])}>
          <Screen />
        </SpacesContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
}

/** La courte explication « Recevoir tes rappels ? » a-t-elle été montrée ? */
const prompted = (alert: jest.SpyInstance) =>
  alert.mock.calls.filter(([title]) => title === i18n.t('reminder.permissionTitle')).length;

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});
beforeEach(async () => {
  mockDb = await createTestDb();
  mockPermission.state = 'undetermined';
  mockPermission.ensure.mockClear();
  mockAsk.mockClear();
});
afterEach(() => {
  mockDb.close();
  jest.restoreAllMocks();
});

describe('Réglages › Notifications : état des rappels', () => {
  it('actifs : nombre programmé et date du dernier rappel', async () => {
    mockPermission.state = 'granted';
    await writeAppSetting(mockDb, 'reminder_status', {
      count: 23,
      lastAt: new Date(2026, 11, 14, 21, 0).toISOString(),
      ranAt: new Date(2026, 8, 23, 10, 0).toISOString(),
      safetyNetAt: new Date(2026, 11, 14, 9, 0).toISOString(),
    });
    await show(SettingsScreen);
    expect(screen.getByTestId('reminder-status-active')).toBeTruthy();
    expect(screen.getByText('Rappels actifs : 23 programmés, jusqu’au 14 déc.')).toBeTruthy();
    expect(
      screen.getByText(i18n.t('settings.reminderStatus.activeHint', { date: '14 déc.' })),
    ).toBeTruthy();
  });

  it('refusées : « tes rappels ne sonneront pas » et « Ouvrir les réglages »', async () => {
    mockPermission.state = 'denied';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await show(SettingsScreen);
    expect(screen.getByText('Notifications refusées : tes rappels ne sonneront pas')).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t('settings.reminderStatus.openSettings')));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('pas encore demandée : « Autoriser les notifications » ouvre le pré-écran', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await show(SettingsScreen);
    expect(screen.getByTestId('reminder-status-undetermined')).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t('settings.allow')));
    await flush();
    expect(prompted(alert)).toBe(1);
  });

  it('tout coupé : « Rappels en pause »', async () => {
    mockPermission.state = 'granted';
    const off = Object.fromEntries(
      Object.entries(defaultNotificationPreferences).map(([k, v]) => [
        k,
        typeof v === 'boolean' && k !== 'sound' && k !== 'vibrate' && !k.startsWith('focus')
          ? false
          : v,
      ]),
    ) as typeof defaultNotificationPreferences;
    await setNotificationPreferences(mockDb, off);
    await show(SettingsScreen);
    expect(screen.getByText(i18n.t('settings.reminderStatus.paused'))).toBeTruthy();
    // Un type de rappel réactivé : l'état change tout de suite.
    await fireEvent(screen.getByLabelText(i18n.t('settings.tasks')), 'valueChange', true);
    await flush();
    expect(screen.queryByText(i18n.t('settings.reminderStatus.paused'))).toBeNull();
  });

  it('le bilan du soir se voit et se coupe dans les réglages', async () => {
    mockPermission.state = 'granted';
    await show(SettingsScreen);
    expect(screen.getByText(i18n.t('settings.eveningReviewHint'))).toBeTruthy();
    await fireEvent(screen.getByLabelText(i18n.t('settings.eveningReview')), 'valueChange', false);
    await flush();
    expect(screen.queryByText(i18n.t('settings.eveningReviewTime'))).toBeNull();
  });
});
