/**
 * Un rappel de charge ou de tontine ouvre la liste, la ligne concernée mise en avant (il n'y a
 * pas d'écran de lecture ; la fiche de modification reste à un appui).
 */
import { act, render, screen, within } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createRecurring } from '@/modules/finance';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import RecurringScreen from '../money/recurring';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}));

const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterEach(() => mockDb.close());

const charge = (name: string) =>
  createRecurring(mockDb, {
    kind: 'charge',
    name,
    categoryId: 'home',
    amountMinor: 35000,
    currency: 'XAF',
    frequency: 'monthly',
    dayOfMonth: 28,
    startDate: '2026-09-01',
    reminders: [],
  });

async function show() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <RecurringScreen />
    </SafeAreaProvider>,
  );
  await flush();
}

describe('charges fixes ouvertes depuis un rappel', () => {
  it('la ligne du rappel est mise en avant, les autres non', async () => {
    await charge('Loyer');
    const id = await charge('Internet');
    mockParams = { highlight: id };
    await show();
    const lit = screen.getByTestId('recurring-highlight');
    expect(within(lit).getByText('Internet')).toBeTruthy();
    expect(within(lit).queryByText('Loyer')).toBeNull();
  });

  it('sans rappel, rien n’est mis en avant', async () => {
    await charge('Loyer');
    mockParams = {};
    await show();
    expect(screen.getByText('Loyer')).toBeTruthy();
    expect(screen.queryByTestId('recurring-highlight')).toBeNull();
  });
});
