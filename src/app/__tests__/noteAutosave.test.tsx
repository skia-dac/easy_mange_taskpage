import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { listNotes } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import NoteScreen from '../notes/[id]';

let mockDb: Db & { close(): void };
const mockParams: Record<string, string> = { id: 'new' };

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
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

const flush = () => act(async () => {});

describe('note : enregistrement automatique', () => {
  it('une frappe rapide pendant la création ne crée qu’une seule note (#11c)', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <NoteScreen />
      </SafeAreaProvider>,
    );
    const title = await screen.findByPlaceholderText(i18n.t('notes.titlePlaceholder'));
    // Premier enregistrement : la création part (elle attend la base) …
    fireEvent.changeText(title, 'Cours');
    act(() => {
      jest.advanceTimersByTime(700);
    });
    // … et l'autosave suivant se déclenche avant qu'elle ait rendu son id.
    fireEvent.changeText(title, 'Cours de marketing');
    act(() => {
      jest.advanceTimersByTime(700);
    });
    for (let i = 0; i < 10; i++) await flush();
    const notes = await listNotes(mockDb);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe('Cours de marketing');
  });
});
