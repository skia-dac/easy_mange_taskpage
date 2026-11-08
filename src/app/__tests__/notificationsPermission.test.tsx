import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { NotificationPermission } from '@/modules/platform';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import NotificationsScreen from '../notifications';

let mockDb: Db & { close(): void };
const mockPermission = {
  state: 'undetermined' as NotificationPermission,
  ensure: jest.fn(async () => true),
};
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));
jest.mock('@/projections', () => ({
  ...jest.requireActual('@/projections'),
  useAgendaData: () => ({ data: undefined, loading: false, error: null, retry: () => undefined }),
}));
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
}));

const flush = () => act(async () => {});

async function show() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <NotificationsScreen />
    </SafeAreaProvider>,
  );
  await flush();
}

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(() => mockPermission.ensure.mockClear());
afterEach(() => jest.restoreAllMocks());

describe('écran Rappels : la permission se demande ici', () => {
  it('pas encore demandée : « Autoriser les notifications » explique puis demande au système', async () => {
    mockPermission.state = 'undetermined';
    mockPermission.ensure.mockImplementation(async () => {
      mockPermission.state = 'granted';
      return true;
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });
    await show();
    await fireEvent.press(screen.getByText('Autoriser les notifications'));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      'Recevoir tes rappels ?',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockPermission.ensure).toHaveBeenCalledTimes(1);
    // Accordée : le bouton disparaît.
    expect(screen.queryByTestId('notifications-permission')).toBeNull();
  });

  it('refusée : « Ouvrir les réglages » du téléphone, sans redemander', async () => {
    mockPermission.state = 'denied';
    const alert = jest.spyOn(Alert, 'alert');
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await show();
    expect(screen.getByText(i18n.t('notifications.off'))).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir les réglages'));
    expect(settings).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('accordée : rien à demander', async () => {
    mockPermission.state = 'granted';
    await show();
    expect(screen.queryByTestId('notifications-permission')).toBeNull();
  });
});
