import { writeAppSetting } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import { getNotebookView, NOTEBOOK_VIEW_KEY, setNotebookView } from './settings';

describe('vue retenue du Carnet', () => {
  it('par défaut : « À faire »', async () => {
    const db = await createTestDb();
    expect(await getNotebookView(db)).toBe('todo');
    db.close();
  });

  it('garde le choix de l’utilisateur', async () => {
    const db = await createTestDb();
    await setNotebookView(db, 'notes');
    expect(await getNotebookView(db)).toBe('notes');
    await setNotebookView(db, 'todo');
    expect(await getNotebookView(db)).toBe('todo');
    db.close();
  });

  it('une valeur corrompue revient à « À faire »', async () => {
    const db = await createTestDb();
    await writeAppSetting(db, NOTEBOOK_VIEW_KEY, 'agenda');
    expect(await getNotebookView(db)).toBe('todo');
    await db.runAsync('UPDATE app_settings SET value = ? WHERE key = ?', [
      '{pas du json',
      NOTEBOOK_VIEW_KEY,
    ]);
    expect(await getNotebookView(db)).toBe('todo');
    db.close();
  });

  it('refuse une vue inconnue', async () => {
    const db = await createTestDb();
    await expect(setNotebookView(db, 'agenda' as 'todo')).rejects.toThrow();
    db.close();
  });
});
