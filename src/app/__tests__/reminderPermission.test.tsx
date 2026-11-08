import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createRecurring } from '@/modules/finance';
import { setNotificationPromptSnoozedAt } from '@/modules/identity';
import type { NotificationPermission } from '@/modules/platform';
import { createHabit } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { createTestDb } from '@/test/memoryDb';

import HabitFormScreen from '../habits/form';
import RecurringFormScreen from '../money/recurring-form';

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
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
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

const habitInput = (reminderTime: string | null) => ({
  name: 'Lire',
  icon: 'book',
  colorId: 'blue',
  frequency: 'daily' as const,
  weekdays: [1, 2, 3, 4, 5],
  timesPerWeek: 3,
  target: 1,
  unit: '',
  reminderTime,
  autoStudy: false,
  tracksBody: false,
});

const charge = (reminders: number[], active = true) =>
  createRecurring(mockDb, {
    kind: 'charge',
    name: 'Loyer',
    categoryId: 'home',
    amountMinor: 35000,
    currency: 'XAF',
    frequency: 'monthly',
    dayOfMonth: 28,
    startDate: '2026-09-01',
    reminders,
    active,
  });

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

describe('habitude : la permission est demandée après l’enregistrement d’un rappel', () => {
  it('avec une heure de rappel : le pré-écran partagé, puis la boîte du système', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === i18n.t('reminder.permissionContinue'))?.onPress?.();
    });
    mockParams = { id: await createHabit(mockDb, habitInput('21:00')) };
    await show(HabitFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('habits.save')));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk).toHaveBeenCalledWith(mockDb);
    expect(prompted(alert)).toBe(1);
    expect(mockPermission.ensure).toHaveBeenCalledTimes(1);
  });

  it('sans heure de rappel : rien n’est demandé', async () => {
    mockParams = { id: await createHabit(mockDb, habitInput(null)) };
    await show(HabitFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('habits.save')));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('« Plus tard » il y a moins de 7 jours : l’explication ne revient pas', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await setNotificationPromptSnoozedAt(mockDb, new Date(2026, 8, 20, 9, 0).toISOString());
    mockParams = { id: await createHabit(mockDb, habitInput('07:30')) };
    await show(HabitFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('habits.save')));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(prompted(alert)).toBe(0);
    expect(mockPermission.ensure).not.toHaveBeenCalled();
  });

  it('déjà accordée : aucune question', async () => {
    mockPermission.state = 'granted';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockParams = { id: await createHabit(mockDb, habitInput('21:00')) };
    await show(HabitFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('habits.save')));
    await flush();
    expect(prompted(alert)).toBe(0);
  });
});

describe('charge fixe ou tontine : la permission est demandée après l’enregistrement', () => {
  it('avec des rappels : le pré-écran partagé', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockParams = { id: await charge([1440]) };
    await show(RecurringFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('money.saveRecurring')));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(prompted(alert)).toBe(1);
  });

  it('sans rappel : rien n’est demandé', async () => {
    mockParams = { id: await charge([]) };
    await show(RecurringFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('money.saveRecurring')));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it('charge en pause, même avec des rappels : rien n’est demandé', async () => {
    mockParams = { id: await charge([1440], false) };
    await show(RecurringFormScreen);
    await fireEvent.press(screen.getByText(i18n.t('money.saveRecurring')));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
  });
});
