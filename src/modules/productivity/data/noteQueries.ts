import type { Db } from '@/shared/db';

import { toAttachment, toNote, type AttachmentRow, type NoteRow } from './noteRows';

const ALIVE = 'deleted_at IS NULL';

export async function listNotes(db: Db, filter: { subjectId?: string; favorites?: boolean } = {}) {
  const where = [ALIVE];
  const params: string[] = [];
  if (filter.subjectId) {
    where.push('subject_id = ?');
    params.push(filter.subjectId);
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
