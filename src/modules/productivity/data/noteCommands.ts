import { write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { AppError } from '@/shared/errors';

import {
  noteCategoryInputSchema,
  noteInputSchema,
  type AttachmentKind,
  type NoteCategoryInput,
  type NoteInput,
} from '../domain/note';

function noteValues(input: NoteInput) {
  const v = parseInput(noteInputSchema, input);
  return {
    title: v.title ?? '',
    content: v.content,
    subject_id: v.subjectId,
    course_series_id: v.courseSeriesId,
    course_date: v.courseDate,
    // Catégorie écrite seulement si elle est donnée : une modification sans elle la garde.
    ...(v.categoryId !== undefined ? { category_id: v.categoryId } : {}),
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
  // Mêmes limites qu'à la création (titre 120, contenu 100 000).
  const v = parseInput(noteInputSchema.pick({ title: true, content: true }), { title, content });
  return write(db, (w) => w.update('notes', id, { title: v.title ?? '', content: v.content }));
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

/** Un cours supprimé : ses notes restent, sans lien vers lui. */
export async function detachNotesFromCourse(w: EntityWriter, seriesId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM notes WHERE course_series_id = ? AND deleted_at IS NULL',
    [seriesId],
  );
  for (const r of rows) await w.update('notes', r.id, { course_series_id: null });
}

/** Les notes d'un cours prises à partir de `fromDate` suivent une nouvelle série (§27 « et les suivants »). */
export async function moveNotesToSeries(
  w: EntityWriter,
  fromSeriesId: string,
  toSeriesId: string,
  fromDate: string,
) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM notes WHERE course_series_id = ? AND course_date >= ? AND deleted_at IS NULL',
    [fromSeriesId, fromDate],
  );
  for (const r of rows) await w.update('notes', r.id, { course_series_id: toSeriesId });
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

export async function createNoteCategory(db: Db, input: NoteCategoryInput) {
  const v = parseInput(noteCategoryInputSchema, input);
  return write(db, async (w) => {
    const last = await w.db.getFirstAsync<{ p: number | null }>(
      'SELECT MAX(position) AS p FROM note_categories WHERE deleted_at IS NULL',
      [],
    );
    return w.insert('note_categories', {
      name: v.name,
      color_id: v.colorId,
      position: (last?.p ?? -1) + 1,
    });
  });
}

export async function updateNoteCategory(db: Db, id: string, input: NoteCategoryInput) {
  const v = parseInput(noteCategoryInputSchema, input);
  return write(db, (w) => w.update('note_categories', id, { name: v.name, color_id: v.colorId }));
}

/** Supprime une catégorie : ses notes restent, simplement sans catégorie. */
export async function deleteNoteCategory(db: Db, id: string) {
  return write(db, async (w) => {
    const exists = await w.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM note_categories WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!exists) throw new AppError('notFound');
    const notes = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM notes WHERE category_id = ? AND deleted_at IS NULL',
      [id],
    );
    for (const n of notes) await w.update('notes', n.id, { category_id: null });
    await w.softDelete('note_categories', id);
  });
}

/** Change la catégorie d'une note sans toucher au reste. */
export async function setNoteCategory(db: Db, noteId: string, categoryId: string | null) {
  return write(db, (w) => w.update('notes', noteId, { category_id: categoryId }));
}
