import { z } from 'zod';

import { isoDate, optionalId, optionalText } from '@/shared/validation';

/**
 * Note de cours (§44–53). Le contenu est un texte avec une mise en forme légère :
 * `# Titre`, `**gras**`, `_italique_`, `- liste`, `1. liste numérotée`, `[ ] / [x] checklist`.
 * Ce format reste lisible tel quel, se synchronise facilement et fonctionne dans Expo Go.
 */
export const noteInputSchema = z.object({
  title: optionalText(120),
  content: z.string().max(100_000, { error: 'validation.tooLong' }).default(''),
  subjectId: optionalId,
  courseSeriesId: optionalId,
  courseDate: isoDate.nullish().transform((v) => v ?? null),
});

export type NoteInput = z.input<typeof noteInputSchema>;
export type Note = {
  id: string;
  title: string;
  content: string;
  subjectId: string | null;
  courseSeriesId: string | null;
  courseDate: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AttachmentKind = 'image' | 'file';
export type Attachment = {
  id: string;
  noteId: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string | null;
  size: number | null;
  localPath: string;
};

/** Titre affiché : le titre saisi, sinon la première ligne du contenu, sinon vide. */
export function noteDisplayTitle(note: Pick<Note, 'title' | 'content'>): string {
  if (note.title.trim()) return note.title.trim();
  const first = note.content.split('\n').find((l) => l.trim() !== '') ?? '';
  return stripMarks(first).slice(0, 80);
}

/** Aperçu court, sans la ligne de titre ni les marques de mise en forme. */
export function notePreview(note: Pick<Note, 'title' | 'content'>, max = 120): string {
  const lines = note.content.split('\n').filter((l) => l.trim() !== '');
  const body = note.title.trim() ? lines : lines.slice(1);
  return body.map(stripMarks).join(' ').slice(0, max);
}

export function stripMarks(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/^\s*(?:[-*]\s+|\d+\.\s+)?\[[ xX]\]\s*/gm, '')
    .replace(/^\s*(?:[-*]|\d+\.)\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .trim();
}
