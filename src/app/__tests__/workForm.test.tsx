import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createWorkItem, getWorkItem, listWorkItems } from '@/modules/productivity';
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
/** Lectures qui échouent avant de réussir (base momentanément illisible). */
const mockFailures = { work: 0 };
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
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
// La permission est demandée une fois le rappel enregistré, jamais pendant le choix.
const mockAsk = jest.fn(async () => 'granted' as const);
jest.mock('@/hooks/useNotificationPermission', () => ({
  ...jest.requireActual('@/hooks/useNotificationPermission'),
  askNotificationPermission: () => mockAsk(),
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

describe('date d’une nouvelle tâche', () => {
  const titled = async (title: string) => {
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('work.titlePlaceholderTask')),
      title,
    );
    await fireEvent.press(screen.getByText('Enregistrer la tâche'));
    await flush();
    return (await listWorkItems(mockDb, 'task')).find((w) => w.title === title);
  };

  it('sans date dans le lien (Carnet, recherche, fin de cours) : « Sans date »', async () => {
    mockParams = {};
    await show();
    expect(screen.getByText(i18n.t('work.noDateHint'))).toBeTruthy();
    expect((await titled('Appeler la banque'))?.dueDate).toBeNull();
  });

  it('depuis Aujourd’hui ou un jour du calendrier : la date du lien est gardée', async () => {
    mockParams = { date: '2026-09-23' };
    await show();
    expect(screen.queryByText(i18n.t('work.noDateHint'))).toBeNull();
    expect((await titled('Réviser le cours'))?.dueDate).toBe('2026-09-23');
  });

  it('« Aujourd’hui » met la date du jour en un appui', async () => {
    mockParams = {};
    await show();
    await fireEvent.press(screen.getByText(i18n.t('work.todayChip')));
    expect(screen.queryByText(i18n.t('work.noDateHint'))).toBeNull();
    expect((await titled('Payer le loyer'))?.dueDate).toBe('2026-09-23');
  });
});

describe('modifier une tâche : lecture ratée', () => {
  it('erreur avec « Réessayer » (pas « introuvable »), puis la fiche', async () => {
    mockFailures.work = 1;
    mockParams = { id: plain, kind: 'task' };
    await show();
    expect(screen.queryByText(i18n.t('errors.itemNotFound'))).toBeNull();
    expect(screen.getByText(i18n.t('state.itemErrorTitle'))).toBeTruthy();
    await fireEvent.press(screen.getByText('Réessayer'));
    await flush();
    expect(screen.getByDisplayValue('Acheter du pain')).toBeTruthy();
  });
});

describe('rappel d’une nouvelle tâche', () => {
  it('la permission est demandée à l’enregistrement, pas en touchant le rappel', async () => {
    mockAsk.mockClear();
    mockParams = { date: '2026-09-30' };
    await show();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('work.titlePlaceholderTask')),
      'Rendre le mémoire',
    );
    await fireEvent.press(screen.getByLabelText('Plus d’options'));
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Enregistrer la tâche'));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    const saved = (await listWorkItems(mockDb, 'task')).find(
      (w) => w.title === 'Rendre le mémoire',
    );
    expect(saved?.reminderAt).toBeTruthy();
  });

  it('sans rappel : rien n’est demandé', async () => {
    mockAsk.mockClear();
    mockParams = {};
    await show();
    await fireEvent.changeText(
      screen.getByPlaceholderText(i18n.t('work.titlePlaceholderTask')),
      'Sans rappel',
    );
    await fireEvent.press(screen.getByText('Enregistrer la tâche'));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
  });
});
