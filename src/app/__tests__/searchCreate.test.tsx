import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactElement } from 'react';

import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import SearchScreen from '../search';
import WorkFormScreen from '../work/form';

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
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const show = (ui: ReactElement) =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>{ui}</GestureHandlerRootView>
    </SafeAreaProvider>,
  );

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

describe('recherche sans résultat', () => {
  it('propose de créer la tâche, titre déjà rempli', async () => {
    mockParams = {};
    await show(<SearchScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText('Matière, cours, note, tâche, examen…'),
      'Acheter du pain',
    );
    await fireEvent.press(await screen.findByText('Créer la tâche « Acheter du pain »'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/work/form',
      params: { title: 'Acheter du pain' },
    });
  });

  it('la fiche tâche reprend le titre proposé', async () => {
    mockParams = { title: 'Acheter du pain' };
    await show(<WorkFormScreen />);
    expect(await screen.findByDisplayValue('Acheter du pain')).toBeTruthy();
  });
});
