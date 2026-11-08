import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';

import { setActiveSpaces, setAppearancePreference } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import RootLayout from '../_layout';

let mockDb: Db & { close(): void };
/** Ce que les widgets reçoivent : espaces actifs et thème de l'app. */
const mockWidgetProps: { personal: boolean; study: boolean; scheme: string }[] = [];
/** Options des écrans déclarés dans la pile racine. */
const mockScreens: { name: string; options?: Record<string, unknown> }[] = [];

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
// Sans mesures initiales, le fournisseur de marges attend l'écran natif et n'affiche rien.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, left: 0, right: 0, bottom: 0 },
  };
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: ReactNode }) =>
      createElement(actual.SafeAreaProvider, { initialMetrics }, children),
  };
});
jest.mock('expo-sqlite', () => ({
  SQLiteProvider: ({ children }: { children: ReactNode }) => children,
  useSQLiteContext: () => mockDb,
}));
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: ReactNode }) => children;
  Stack.Screen = function Screen(props: { name: string; options?: Record<string, unknown> }) {
    mockScreens.push(props);
    return null;
  };
  return {
    Stack,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useSegments: () => [],
  };
});
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  LanguageGate: () => null,
}));
jest.mock('@/components/AccountGate', () => ({ AccountGate: () => null }));
jest.mock('@/components/MoneyGate', () => ({ MoneyGate: () => null }));
jest.mock('@/components/ConflictsGate', () => ({ ConflictsGate: () => null }));
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  BackupGate: () => null,
  FeedbackGate: () => null,
  LockGate: () => null,
  NotificationsGate: () => null,
}));
jest.mock('@/components/WidgetsGate', () => {
  const { useSpaces } = jest.requireActual('@/shared/SpacesContext');
  const { useTheme } = jest.requireActual('@/shared/theme');
  return {
    WidgetsGate: () => {
      const spaces = useSpaces();
      mockWidgetProps.push({
        personal: spaces.has('personal'),
        study: spaces.has('study'),
        scheme: useTheme().scheme,
      });
      return null;
    },
  };
});

const flush = () => act(async () => {});

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  // Perso coupé et thème sombre choisi dans l'app : les widgets doivent le savoir.
  await setActiveSpaces(mockDb, ['study']);
  await setAppearancePreference(mockDb, 'dark');
});
afterAll(() => mockDb.close());

describe('layout racine', () => {
  it('les widgets reçoivent les vrais espaces et le thème choisi (pas les valeurs par défaut)', async () => {
    await render(<RootLayout />);
    await flush();
    await flush();
    const last = mockWidgetProps.at(-1);
    expect(last).toEqual({ personal: false, study: true, scheme: 'dark' });
    // Jamais rendus avec les valeurs par défaut (argent affiché alors que Perso est coupé).
    expect(mockWidgetProps.some((p) => p.personal)).toBe(false);
  });

  it('la fenêtre « Ajouter » a un bouton « Fermer »', async () => {
    await render(<RootLayout />);
    await flush();
    const add = mockScreens.filter((s) => s.name === 'add').at(-1);
    expect(add?.options?.presentation).toBe('modal');
    const headerRight = add?.options?.headerRight as () => ReactElement;
    await render(headerRight());
    await fireEvent.press(screen.getByText('Fermer'));
    expect(router.back).toHaveBeenCalled();
  });
});
