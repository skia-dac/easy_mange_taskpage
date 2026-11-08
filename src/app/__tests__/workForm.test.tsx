import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createWorkItem, getWorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { createTestDb } from '@/test/memoryDb';

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

let detailed = '';
let plain = '';
beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  detailed = await createWorkItem(mockDb, 'task', {
    title: 'Préparer la réunion',
    dueDate: '2026-09-24',
    priority: 'important',
    status: 'todo',
    description: 'Ordre du jour',
  });
  plain = await createWorkItem(mockDb, 'task', {
    title: 'Acheter du pain',
    dueDate: '2026-09-24',
    priority: 'normal',
    status: 'todo',
  });
});
afterAll(() => mockDb.close());

const flush = () => act(async () => {});

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
          <WorkFormScreen />
        </SpacesContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
}

describe('fiche de tâche courte', () => {
  it('à la création : titre et date d’abord, le reste dans « Plus d’options », pas de statut', async () => {
    mockParams = {};
    await show();
    expect(screen.getByText(/^Titre/)).toBeTruthy();
    expect(screen.getByText(/^Date/)).toBeTruthy();
    expect(screen.queryByText('Statut')).toBeNull();
    expect(screen.queryByText('Priorité')).toBeNull();
    const more = screen.getByLabelText('Plus d’options');
    expect(more.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(more);
    expect(screen.getByText('Priorité')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByLabelText('Plus d’options').props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });

  it('à la modification : statut affiché, options ouvertes si la tâche en a', async () => {
    mockParams = { id: detailed, kind: 'task' };
    await show();
    expect(screen.getByText('Statut')).toBeTruthy();
    expect(screen.getByText('Priorité')).toBeTruthy();
    expect(screen.getByDisplayValue('Ordre du jour')).toBeTruthy();
  });

  it('à la modification d’une tâche simple : options repliées', async () => {
    mockParams = { id: plain, kind: 'task' };
    await show();
    expect(screen.getByDisplayValue('Acheter du pain')).toBeTruthy();
    expect(screen.getByText('Statut')).toBeTruthy();
    expect(screen.queryByText('Priorité')).toBeNull();
  });

  it('lien sans `kind` : la tâche est retrouvée dans sa table (jamais « introuvable » à tort)', async () => {
    mockParams = { id: plain };
    await show();
    expect(screen.getByDisplayValue('Acheter du pain')).toBeTruthy();
    expect(screen.queryByText('Élément introuvable')).toBeNull();
  });

  it('élément supprimé entre-temps : « introuvable » avec « Retour », pas un formulaire vide', async () => {
    mockParams = { id: 'disparu', kind: 'task' };
    await show();
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
    expect(screen.getByText('Retour')).toBeTruthy();
    expect(screen.queryByText(/^Titre/)).toBeNull();
  });

  it('« Effacer » la date la retire vraiment : la tâche passe « Sans date »', async () => {
    const id = await createWorkItem(mockDb, 'task', {
      title: 'Ranger le bureau',
      dueDate: '2026-09-24',
      priority: 'normal',
      status: 'todo',
    });
    mockParams = { id, kind: 'task' };
    await show();
    expect(screen.queryByText(i18n.t('work.noDateHint'))).toBeNull();
    await fireEvent.press(screen.getByText('Effacer'));
    expect(screen.getByText(i18n.t('work.noDateHint'))).toBeTruthy();
    await fireEvent.press(screen.getByText('Enregistrer la tâche'));
    await flush();
    expect((await getWorkItem(mockDb, 'task', id))?.dueDate).toBeNull();
  });
});
