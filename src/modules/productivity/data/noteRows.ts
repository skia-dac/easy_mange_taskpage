import { normalizeSpaceValue } from '@/shared/spaces';
import { enumOr } from '@/shared/validation';

import { attachmentKinds, type Attachment, type Note, type NoteCategory } from '../domain/note';

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
  category_id?: string | null;
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
  categoryId: r.category_id ?? null,
});

export type NoteCategoryRow = { id: string; name: string; color_id: string; position: number };

export const toNoteCategory = (r: NoteCategoryRow): NoteCategory => ({
  id: r.id,
  name: r.name,
  colorId: r.color_id,
  position: r.position,
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
  kind: enumOr(attachmentKinds, r.kind, 'file'),
  name: r.name,
  mimeType: r.mime_type,
  size: r.size,
  localPath: r.local_path,
});
