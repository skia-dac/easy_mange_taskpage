import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { conflictCount } from '@/modules/platform';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import ConflictsScreen from '../account/conflicts';

let mockDb: Db & { close(): void };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));

const flush = () => act(async () => {});

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterEach(() => {
  jest.restoreAllMocks();
  mockDb.close();
});

async function addReplacedConflict() {
  await mockDb.runAsync(
    `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at)
     VALUES ('c1', 'tasks', 't1', ?, ?, '2026-09-24T08:00:00.000Z')`,
    [
      JSON.stringify({ id: 't1', title: 'Exposé (moi)', due_date: '2026-10-01' }),
      JSON.stringify({ id: 't1', title: 'Exposé (autre)', due_date: '2026-10-01' }),
    ],
  );
}

describe('conflits de synchronisation', () => {
  it('montre les deux versions et demande confirmation avant d’abandonner la sienne', async () => {
    await addReplacedConflict();
    await render(<ConflictsScreen />);
    await flush();
    expect(screen.getByText('Ta version (ce téléphone) : Exposé (moi)')).toBeTruthy();
    expect(screen.getByText('Version gardée (serveur) : Exposé (autre)')).toBeTruthy();
    expect(screen.getByText('Titre · différent')).toBeTruthy();

    // Annuler : rien n'est abandonné.
    const cancel = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'cancel')?.onPress?.();
    });
    await fireEvent.press(screen.getByText('Ignorer'));
    await flush();
    expect(cancel).toHaveBeenCalledWith(
      i18n.t('conflicts.ignoreTitle'),
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    expect(await conflictCount(mockDb)).toBe(1);

    // Confirmer : le conflit est classé.
    cancel.mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByText('Ignorer'));
    await flush();
    expect(await conflictCount(mockDb)).toBe(0);
  });

  it('lecture en échec : un vrai message d’erreur avec « Réessayer », jamais « Aucun conflit »', async () => {
    const real = mockDb.getAllAsync.bind(mockDb);
    const spy = jest
      .spyOn(mockDb, 'getAllAsync')
      .mockImplementation(() => Promise.reject(new Error('disk')));
    await render(<ConflictsScreen />);
    await flush();
    expect(screen.queryByText('Aucun conflit en attente')).toBeNull();
    expect(screen.getByText('Réessayer')).toBeTruthy();

    spy.mockImplementation(real);
    await fireEvent.press(screen.getByText('Réessayer'));
    await flush();
    expect(screen.getByText('Aucun conflit en attente')).toBeTruthy();
  });
});
