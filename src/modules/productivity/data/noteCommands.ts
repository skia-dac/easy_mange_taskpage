import { write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { noteInputSchema, type AttachmentKind, type NoteInput } from '../domain/note';

function noteValues(input: NoteInput) {
  const v = parseInput(noteInputSchema, input);
  return {
    title: v.title ?? '',
    content: v.content,
    subject_id: v.subjectId,
    course_series_id: v.courseSeriesId,
    course_date: v.courseDate,
    // Espace écrit seulement s'il est donné ; une note de matière ou de cours va dans Études.
    ...(v.subjectId || v.courseSeriesId ? { space: 'study' } : v.space ? { space: v.space } : {}),
  };
}

export async function createNote(db: Db, input: NoteInput) {
  const values = noteValues(input);
  return write(db, (w) => w.insert('notes', values));
}

export async function updateNote(db: Db, id: string, input: NoteInput) {
  const values = noteValues(input);
  return write(db, (w) => w.update('notes', id, values));
}

/** Enregistrement rapide du contenu seul (sauvegarde automatique pendant la frappe). */
export async function saveNoteContent(db: Db, id: string, title: string, content: string) {
  return write(db, (w) => w.update('notes', id, { title: title.trim().slice(0, 120), content }));
}

export async function setNoteFavorite(db: Db, id: string, isFavorite: boolean) {
  return write(db, (w) => w.update('notes', id, { is_favorite: isFavorite ? 1 : 0 }));
}

export async function deleteNote(db: Db, id: string) {
  return write(db, async (w) => {
    await deleteAttachmentsOfNote(w, id);
    await w.softDelete('notes', id);
  });
}

async function deleteAttachmentsOfNote(w: EntityWriter, noteId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM attachments WHERE note_id = ? AND deleted_at IS NULL',
    [noteId],
  );
  for (const r of rows) await w.softDelete('attachments', r.id);
}

export type NewAttachment = {
  kind: AttachmentKind;
  name: string;
  mimeType: string | null;
  size: number | null;
  localPath: string;
};

export async function addAttachment(db: Db, noteId: string, a: NewAttachment) {
  return write(db, (w) =>
    w.insert('attachments', {
      note_id: noteId,
      kind: a.kind,
      name: a.name,
      mime_type: a.mimeType,
      size: a.size,
      local_path: a.localPath,
    }),
  );
}

export async function removeAttachment(db: Db, id: string) {
  return write(db, (w) => w.softDelete('attachments', id));
}

/** Les notes d'une matière supprimée restent, sans matière (§16). */
export async function detachNotesFromSubject(w: EntityWriter, subjectId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM notes WHERE subject_id = ? AND deleted_at IS NULL',
    [subjectId],
  );
  for (const r of rows) await w.update('notes', r.id, { subject_id: null, course_series_id: null });
}

export async function deleteNotesOfSubject(w: EntityWriter, subjectId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM notes WHERE subject_id = ? AND deleted_at IS NULL',
    [subjectId],
  );
  for (const r of rows) {
    await deleteAttachmentsOfNote(w, r.id);
    await w.softDelete('notes', r.id);
  }
}
