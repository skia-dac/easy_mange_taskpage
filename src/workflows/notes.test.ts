import { createSubject } from '@/modules/academic';
import {
  addAttachment,
  createNote,
  deleteNote,
  getNote,
  listAttachments,
  listNotes,
  searchNotes,
  setNoteFavorite,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import { deleteSubject, subjectUsage } from './deleteSubject';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

describe('notes (§45–53)', () => {
  it('crée, retrouve, met en favori et cherche une note', async () => {
    const subjectId = await createSubject(db, { name: 'Marketing', colorId: 'violet' });
    const id = await createNote(db, {
      title: 'Les 4P',
      content: '- **produit**\n- prix',
      subjectId,
    });
    expect((await getNote(db, id))?.subjectId).toBe(subjectId);
    await setNoteFavorite(db, id, true);
    expect(await listNotes(db, { favorites: true })).toHaveLength(1);
    expect((await searchNotes(db, 'prix')).map((n) => n.id)).toEqual([id]);
    expect(await searchNotes(db, 'finance')).toEqual([]);
  });

  it('une note peut exister sans matière (règle 4)', async () => {
    const id = await createNote(db, { content: 'Idées mémoire' });
    expect((await getNote(db, id))?.subjectId).toBeNull();
  });

  it('supprimer une note supprime ses pièces jointes', async () => {
    const id = await createNote(db, { content: 'x' });
    await addAttachment(db, id, {
      kind: 'file',
      name: 'chapitre.pdf',
      mimeType: 'application/pdf',
      size: 10,
      localPath: 'attachments/x/a.pdf',
    });
    expect(await listAttachments(db, id)).toHaveLength(1);
    await deleteNote(db, id);
    expect(await getNote(db, id)).toBeNull();
    expect(await listAttachments(db, id)).toEqual([]);
  });

  it('supprimer une matière en gardant son contenu garde les notes, sans matière (§16)', async () => {
    const subjectId = await createSubject(db, { name: 'Marketing', colorId: 'violet' });
    const id = await createNote(db, { content: 'x', subjectId });
    expect((await subjectUsage(db, subjectId)).notes).toBe(1);
    await deleteSubject(db, subjectId, 'keepWork');
    expect((await getNote(db, id))?.subjectId).toBeNull();
  });

  it('« tout supprimer » supprime aussi les notes', async () => {
    const subjectId = await createSubject(db, { name: 'Marketing', colorId: 'violet' });
    const id = await createNote(db, { content: 'x', subjectId });
    await deleteSubject(db, subjectId, 'deleteAll');
    expect(await getNote(db, id)).toBeNull();
  });
});
