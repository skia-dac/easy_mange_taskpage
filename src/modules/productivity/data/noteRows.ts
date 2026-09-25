import { normalizeSpaceValue } from '@/shared/spaces';

import type { Attachment, AttachmentKind, Note } from '../domain/note';

export type NoteRow = {
  id: string;
  title: string;
  content: string;
  subject_id: string | null;
  course_series_id: string | null;
  course_date: string | null;
  is_favorite: number;
  created_at: string;
  updated_at: string;
  space?: string | null;
};

export const toNote = (r: NoteRow): Note => ({
  id: r.id,
  title: r.title,
  content: r.content,
  subjectId: r.subject_id,
  courseSeriesId: r.course_series_id,
  courseDate: r.course_date,
  isFavorite: r.is_favorite === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  space: normalizeSpaceValue(r.space),
});

export type AttachmentRow = {
  id: string;
  note_id: string;
  kind: string;
  name: string;
  mime_type: string | null;
  size: number | null;
  local_path: string;
};

export const toAttachment = (r: AttachmentRow): Attachment => ({
  id: r.id,
  noteId: r.note_id,
  kind: r.kind as AttachmentKind,
  name: r.name,
  mimeType: r.mime_type,
  size: r.size,
  localPath: r.local_path,
});
