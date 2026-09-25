import { createTestDb } from '@/test/memoryDb';

import {
  createNote,
  createNoteCategory,
  deleteNoteCategory,
  saveNoteContent,
  updateNote,
  updateNoteCategory,
} from '../data/noteCommands';
import { getNote, listNoteCategories } from '../data/noteQueries';

describe('catégories de notes', () => {
  it('se créent, se renomment, et une modification sans catégorie la garde', async () => {
    const db = await createTestDb();
    const idees = await createNoteCategory(db, { name: 'Idées', colorId: 'blue' });
    await createNoteCategory(db, { name: 'Réunions' });
    await updateNoteCategory(db, idees, { name: 'Idées produit', colorId: 'green' });
    expect((await listNoteCategories(db)).map((c) => [c.name, c.colorId])).toEqual([
      ['Idées produit', 'green'],
      ['Réunions', 'slate'],
    ]);
    const note = await createNote(db, { title: 'Démo', content: 'x', categoryId: idees });
    await updateNote(db, note, { title: 'Démo', content: 'y' });
    await saveNoteContent(db, note, 'Démo v2', 'z');
    expect((await getNote(db, note))?.categoryId).toBe(idees);
    db.close();
  });

  it('supprimer une catégorie garde ses notes, sans catégorie', async () => {
    const db = await createTestDb();
    const cat = await createNoteCategory(db, { name: 'Recettes' });
    const note = await createNote(db, { title: 'Ndolé', content: 'arachides', categoryId: cat });
    await deleteNoteCategory(db, cat);
    const kept = await getNote(db, note);
    expect(kept?.content).toBe('arachides');
    expect(kept?.categoryId).toBeNull();
    expect(await listNoteCategories(db)).toEqual([]);
    db.close();
  });
});
