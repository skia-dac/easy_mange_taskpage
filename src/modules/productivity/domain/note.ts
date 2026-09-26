import { z } from 'zod';

import { spaceSchema, type SpaceId } from '@/shared/spaces';
import { isoDate, optionalId, optionalText, requiredText } from '@/shared/validation';

/**
 * Note de cours (§44–53). Le contenu est un texte avec une mise en forme légère :
 * `# Titre`, `**gras**`, `_italique_`, `- liste`, `1. liste numérotée`, `[ ] / [x] checklist`.
 * Ce format reste lisible tel quel, se synchronise facilement et fonctionne dans Expo Go.
 */
/** Longueur maximale d'une note (au-delà, l'enregistrement automatique coupe le texte). */
export const NOTE_CONTENT_MAX = 100_000;

export const noteInputSchema = z.object({
  title: optionalText(120),
  content: z.string().max(NOTE_CONTENT_MAX, { error: 'validation.tooLong' }).default(''),
  subjectId: optionalId,
  courseSeriesId: optionalId,
  courseDate: isoDate.nullish().transform((v) => v ?? null),
  /** Ancien champ (les notes sont communes à tous les espaces) : gardé, plus utilisé. */
  space: spaceSchema.optional(),
  /** Catégorie créée par l'utilisateur ; absent à la modification = on garde celle enregistrée. */
  categoryId: z.string().min(1).nullable().optional(),
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
  space: SpaceId;
  categoryId: string | null;
};

/**
 * Catégorie de notes créée par l'utilisateur (Idées, Réunions, Recettes…). Les notes sont
 * communes aux trois espaces : les catégories servent à les ranger.
 */
export const noteCategoryInputSchema = z.object({
  name: requiredText(40),
  colorId: z.string().min(1).default('slate'),
});
export type NoteCategoryInput = z.input<typeof noteCategoryInputSchema>;
export type NoteCategory = { id: string; name: string; colorId: string; position: number };

export const attachmentKinds = ['image', 'file'] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];
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
