/**
 * Les listes virtualisées (Carnet : tâches et notes ; historique de l'argent) montrent leurs
 * lignes, leurs états vides et d'échec, et ne montrent les tâches terminées que par pages.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import MoneyHistoryScreen from '@/app/money/history';
import { createTransaction } from '@/modules/finance';
import { createNote, createWorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { NotesPane } from './NotesPane';
import { DONE_PAGE, TodoPane } from './TodoPane';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) }); // mercredi 23 sept. 2026

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
});
beforeEach(async () => {
  mockDb = await createTestDb();
});
afterEach(() => mockDb.close());

describe('Carnet — tâches', () => {
  it('liste vide : l’état vide, sans bouton des terminées', async () => {
    await show(<TodoPane title="Carnet" />);
    expect(await screen.findByText('Rien à faire pour le moment.')).toBeTruthy();
    expect(screen.queryByText(/Afficher les terminées/)).toBeNull();
  });

  it('montre les tâches ouvertes, et les terminées repliées puis par pages', async () => {
    await createWorkItem(mockDb, 'task', {
      title: 'Rendre le rapport',
      dueDate: '2026-09-23',
      priority: 'normal',
      status: 'todo',
    });
    const doneCount = DONE_PAGE + 5;
    for (let i = 0; i < doneCount; i++)
      await createWorkItem(mockDb, 'task', {
        title: `Terminée ${i}`,
        dueDate: '2026-09-20',
        priority: 'normal',
        status: 'done',
      });

    await show(<TodoPane title="Carnet" />);
    expect(await screen.findByText('Rendre le rapport')).toBeTruthy();
    expect(screen.queryByText('Terminée 0')).toBeNull();

    await fireEvent.press(screen.getByText(`Afficher les terminées (${doneCount})`));
    expect(await screen.findByText('Terminées')).toBeTruthy();
    // Le reste attend « Voir plus » (5 de plus).
    await fireEvent.press(await screen.findByText('Voir plus (5)'));
    expect(screen.queryByText(/Voir plus/)).toBeNull();
    expect(screen.getByText('Masquer les terminées')).toBeTruthy();
  });
});

describe('Carnet — notes', () => {
  it('liste vide : l’état vide', async () => {
    await show(<NotesPane title="Carnet" />);
    expect(await screen.findByText('Tu n’as encore aucune note.')).toBeTruthy();
  });

  it('montre les notes, avec un aperçu tiré du début seulement', async () => {
    await createNote(mockDb, { title: 'Les 4P', content: `Produit, prix\n${'x'.repeat(5000)}` });
    await createNote(mockDb, { title: 'Bilan', content: 'Actif et passif' });
    await show(<NotesPane title="Carnet" />);
    expect(await screen.findByText('Les 4P')).toBeTruthy();
    expect(screen.getByText('Bilan')).toBeTruthy();
    expect(screen.getByText('Actif et passif')).toBeTruthy();
  });
});

describe('Argent — historique', () => {
  it('période vide : l’état vide', async () => {
    await show(<MoneyHistoryScreen />);
    expect(await screen.findByText('Aucune opération sur cette période.')).toBeTruthy();
  });

  it('montre les opérations de la période', async () => {
    await createTransaction(mockDb, {
      kind: 'expense',
      amountMinor: 1500,
      currency: 'XAF',
      date: '2026-09-22',
      categoryId: 'food',
      note: 'Beignets',
    });
    await show(<MoneyHistoryScreen />);
    expect(await screen.findByText(/Beignets/)).toBeTruthy();
  });

  it('échec de lecture : un message et « Réessayer », jamais un chargement sans fin', async () => {
    const failing = mockDb;
    mockDb = Object.assign(Object.create(failing) as typeof failing, {
      getAllAsync: () => Promise.reject(new Error('disk')),
      getFirstAsync: () => Promise.reject(new Error('disk')),
      close: () => failing.close(),
    });
    await show(<MoneyHistoryScreen />);
    expect(await screen.findByText('Réessayer')).toBeTruthy();
  });
});
