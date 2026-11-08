import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createWorkItem } from '@/modules/productivity';
import { atTime } from '@/shared/dates';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { createTestDb } from '@/test/memoryDb';

import WorkDetailScreen from '../work/[id]';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = {};
const mockFailures = { work: 0 };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => mockParams,
  useSegments: () => [],
  Stack: { Screen: () => null },
}));
jest.mock('@/modules/productivity', () => {
  const actual = jest.requireActual('@/modules/productivity');
  return {
    ...actual,
    getWorkItemOfKind: (...args: unknown[]) => {
      if (mockFailures.work > 0) {
        mockFailures.work -= 1;
        return Promise.reject(new Error('lecture impossible'));
      }
      return actual.getWorkItemOfKind(...args);
    },
  };
});
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const flush = () => act(async () => {});
let reminded = '';
let undated = '';

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  reminded = await createWorkItem(mockDb, 'task', {
    title: 'Rendre le rapport',
    dueDate: '2026-09-25',
    priority: 'normal',
    status: 'todo',
    reminderAt: atTime('2026-09-24', '18:00').toISOString(),
  });
  undated = await createWorkItem(mockDb, 'task', {
    title: 'Trier les photos',
    dueDate: null,
    priority: 'normal',
    status: 'todo',
  });
});
afterAll(() => mockDb.close());

async function show() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <SpacesContext.Provider value={spacesValue(['work'])}>
          <WorkDetailScreen />
        </SpacesContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
}

describe('détail d’une tâche', () => {
  it('montre le rappel choisi', async () => {
    mockParams = { id: reminded, kind: 'task' };
    await show();
    expect(screen.getByText(i18n.t('reminder.label'))).toBeTruthy();
    expect(screen.getByText(/24 sept\. 2026.*18:00/)).toBeTruthy();
    expect(screen.getByText(i18n.t('postpone.action'))).toBeTruthy();
  });

  it('sans date : pas de « Reporter »', async () => {
    mockParams = { id: undated, kind: 'task' };
    await show();
    expect(screen.getByText('Trier les photos')).toBeTruthy();
    expect(screen.queryByText(i18n.t('postpone.action'))).toBeNull();
  });

  it('lecture ratée : erreur avec « Réessayer », pas « introuvable »', async () => {
    mockFailures.work = 1;
    mockParams = { id: reminded, kind: 'task' };
    await show();
    expect(screen.queryByText(i18n.t('errors.itemNotFound'))).toBeNull();
    expect(screen.getByText(i18n.t('state.itemErrorTitle'))).toBeTruthy();
    await fireEvent.press(screen.getByText('Réessayer'));
    await flush();
    expect(screen.getByText('Rendre le rapport')).toBeTruthy();
  });

  it('tâche supprimée : « introuvable »', async () => {
    mockParams = { id: 'disparue', kind: 'task' };
    await show();
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
  });
});
