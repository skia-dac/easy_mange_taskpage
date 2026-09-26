import { AppError } from '../errors';
import { assertSafeColumns, EntityWriter } from './entityWriter';
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
