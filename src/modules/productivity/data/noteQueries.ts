import type { Db } from '@/shared/db';

import {
  toAttachment,
  toNote,
  toNoteCategory,
  type AttachmentRow,
  type NoteCategoryRow,
  type NoteRow,
} from './noteRows';

const ALIVE = 'deleted_at IS NULL';

export async function listNotes(
  db: Db,
  filter: {
    subjectId?: string;
    favorites?: boolean;
    /** Notes prises pendant ce cours (et, avec `courseDate`, pendant cette séance). */
    courseSeriesId?: string;
    courseDate?: string;
  } = {},
) {
  const where = [ALIVE];
  const params: string[] = [];
  if (filter.subjectId) {
    where.push('subject_id = ?');
    params.push(filter.subjectId);
  }
  if (filter.courseSeriesId) {
    where.push('course_series_id = ?');
    params.push(filter.courseSeriesId);
  }
  if (filter.courseDate) {
    where.push('course_date = ?');
    params.push(filter.courseDate);
  }
  if (filter.favorites) where.push('is_favorite = 1');
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    params,
  );
  return rows.map(toNote);
}

/** Recherche simple sur le titre et le contenu (§53). */
export async function searchNotes(db: Db, query: string) {
  const q = `%${query.trim().replace(/[%_]/g, '')}%`;
  const rows = await db.getAllAsync<NoteRow>(
    `SELECT * FROM notes WHERE ${ALIVE} AND (title LIKE ? OR content LIKE ?) ORDER BY updated_at DESC LIMIT 100`,
    [q, q],
  );
  return rows.map(toNote);
}

/** Caractères du contenu lus pour une vignette : de quoi faire le titre et l'aperçu. */
export const NOTE_EXCERPT_CHARS = 600;

const SUMMARY_COLUMNS = `id, title, substr(content, 1, ${NOTE_EXCERPT_CHARS}) AS content, subject_id,
  course_series_id, course_date, is_favorite, created_at, updated_at, space, category_id`;

/**
 * Notes de la liste du Carnet, avec le début du contenu seulement (`content` est un extrait) :
 * une longue note n'est jamais lue en entier pour sa vignette. Avec `query`, recherche dans le
 * titre et TOUT le contenu (comme `searchNotes`). Ne pas enregistrer une note lue ainsi.
 */
export async function listNoteSummaries(db: Db, query = '') {
  const q = query.trim().replace(/[%_]/g, '');
  const rows = q
    ? await db.getAllAsync<NoteRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM notes WHERE ${ALIVE} AND (title LIKE ? OR content LIKE ?)
         ORDER BY updated_at DESC LIMIT 100`,
        [`%${q}%`, `%${q}%`],
      )
    : await db.getAllAsync<NoteRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM notes WHERE ${ALIVE} ORDER BY updated_at DESC`,
        [],
      );
  return rows.map(toNote);
}

export async function getNote(db: Db, id: string) {
  const row = await db.getFirstAsync<NoteRow>(`SELECT * FROM notes WHERE id = ? AND ${ALIVE}`, [
    id,
  ]);
  return row ? toNote(row) : null;
}

export async function listAttachments(db: Db, noteId: string) {
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT * FROM attachments WHERE ${ALIVE} AND note_id = ? ORDER BY created_at`,
    [noteId],
  );
  return rows.map(toAttachment);
}

export async function countNotesForSubject(db: Db, subjectId: string) {
  return (
    (
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM notes WHERE ${ALIVE} AND subject_id = ?`,
        [subjectId],
      )
    )?.n ?? 0
  );
}

export async function listNoteCategories(db: Db) {
  const rows = await db.getAllAsync<NoteCategoryRow>(
    `SELECT * FROM note_categories WHERE ${ALIVE} ORDER BY position, name`,
    [],
  );
  return rows.map(toNoteCategory);
}

export async function getNoteCategory(db: Db, id: string) {
  const row = await db.getFirstAsync<NoteCategoryRow>(
    `SELECT * FROM note_categories WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toNoteCategory(row) : null;
}
