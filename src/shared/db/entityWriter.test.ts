import { createTestDb } from '@/test/memoryDb';

import { AppError } from '../errors';
import { subscribeToChanges } from './changes';
import { assertSafeColumns, EntityWriter, write } from './entityWriter';
import type { Db } from './types';

describe('assertSafeColumns', () => {
  it('accepte des colonnes nommées en minuscules avec null', () => {
    expect(assertSafeColumns({ title: 'Devoir', due_time: null, position: 2 })).toEqual([
      'title',
      'due_time',
      'position',
    ]);
  });

  it('refuse un nom de colonne inattendu', () => {
    expect(() => assertSafeColumns({ 'title; DROP': 'x' })).toThrow('Nom de colonne invalide');
  });

  it('refuse undefined (la colonne passerait à NULL localement sans le dire au serveur)', () => {
    const values = { title: 'Devoir', due_time: undefined as unknown as null };
    expect(() => assertSafeColumns(values)).toThrow(AppError);
    expect(() => assertSafeColumns(values)).toThrow('due_time');
  });

  it("EntityWriter n'écrit rien quand une valeur est absente", async () => {
    const runAsync = jest.fn(async () => undefined);
    const txn = { runAsync } as unknown as Db;
    const writer = new EntityWriter(txn);
    await expect(
      writer.insert('tasks', { title: undefined as unknown as null }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      writer.update('tasks', 'id1', { title: undefined as unknown as null }),
    ).rejects.toBeInstanceOf(AppError);
    expect(runAsync).not.toHaveBeenCalled();
  });
});

describe('EntityWriter.update sans changement', () => {
  let db: Db & { close(): void };
  beforeEach(async () => {
    db = await createTestDb();
  });
  afterEach(() => db.close());

  const OLD = '2026-01-01T00:00:00.000Z';
  const row = (id: string) =>
    db.getFirstAsync<{ title: string; updated_at: string; sync_status: string }>(
      'SELECT title, updated_at, sync_status FROM notes WHERE id = ?',
      [id],
    );
  const outbox = async () =>
    (await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox', []))?.n ?? 0;
  /** Une note déjà envoyée au serveur, modifiée pour la dernière fois le 1er janvier. */
  const syncedNote = async () => {
    const id = await write(db, (w) =>
      w.insert('notes', { title: 'Cours', content: 'Texte', is_favorite: 0, subject_id: null }),
    );
    await db.runAsync("UPDATE notes SET updated_at = ?, sync_status = 'synced' WHERE id = ?", [
      OLD,
      id,
    ]);
    await db.runAsync('DELETE FROM sync_outbox', []);
    return id;
  };

  it('ne touche ni updated_at, ni la file, ni les écrans quand rien ne change', async () => {
    const id = await syncedNote();
    const listener = jest.fn();
    const unsubscribe = subscribeToChanges(listener);
    await write(db, (w) =>
      w.update('notes', id, { title: 'Cours', content: 'Texte', is_favorite: 0, subject_id: null }),
    );
    unsubscribe();
    expect(await row(id)).toEqual({ title: 'Cours', updated_at: OLD, sync_status: 'synced' });
    expect(await outbox()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('écrit dès qu’une seule valeur change', async () => {
    const id = await syncedNote();
    await write(db, (w) => w.update('notes', id, { title: 'Cours', content: 'Texte modifié' }));
    const after = await row(id);
    expect(after?.updated_at).not.toBe(OLD);
    expect(after?.sync_status).toBe('pending_update');
    expect(await outbox()).toBe(1);
  });

  it('refuse toujours une ligne absente', async () => {
    await expect(write(db, (w) => w.update('notes', 'absente', { title: 'x' }))).rejects.toThrow(
      AppError,
    );
  });
});
