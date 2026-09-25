import { z } from 'zod';

import { examInputSchema } from '@/modules/academic';
import {
  createNote,
  getNote,
  habitInputSchema,
  noteInputSchema,
  saveNoteContent,
} from '@/modules/productivity';
import { createTestDb } from '@/test/memoryDb';

import { isValidationError, parseInput, ValidationError } from './validation';

const errorsOf = (fn: () => unknown): Record<string, string> => {
  try {
    fn();
  } catch (e) {
    if (isValidationError(e)) return e.fields;
    throw e;
  }
  throw new Error('aucune erreur');
};

describe('messages de validation : jamais techniques', () => {
  it('un message zod par défaut devient « Valeur non valide »', () => {
    const schema = z.object({ n: z.number().int() });
    expect(errorsOf(() => parseInput(schema, { n: Number.NaN }))).toEqual({
      n: 'validation.invalid',
    });
    expect(errorsOf(() => parseInput(schema, { n: 1.5 }))).toEqual({ n: 'validation.invalid' });
  });

  it('examen : durée, note, barème et coefficient ont chacun leur clé', () => {
    const base = { subjectId: 'mkt', date: '2026-10-12' };
    const f = (over: Record<string, unknown>) =>
      errorsOf(() => parseInput(examInputSchema, { ...base, ...over }));
    expect(f({ durationMinutes: Number.NaN }).durationMinutes).toBe('validation.invalidDuration');
    expect(f({ durationMinutes: 1.5 }).durationMinutes).toBe('validation.invalidDuration');
    expect(f({ grade: Number.NaN }).grade).toBe('validation.invalidGrade');
    expect(f({ gradeMax: Number.NaN }).gradeMax).toBe('validation.invalidGrade');
    expect(f({ gradeMax: 1e15 }).gradeMax).toBe('validation.invalidGrade');
    expect(f({ coefficient: Number.NaN }).coefficient).toBe('validation.invalidCoefficient');
  });

  it('habitude : objectif et fois par semaine', () => {
    const f = (over: Record<string, unknown>) =>
      errorsOf(() => parseInput(habitInputSchema, { name: 'Eau', ...over }));
    expect(f({ target: 1.5 }).target).toBe('validation.invalidCount');
    expect(f({ target: 100 }).target).toBe('validation.invalidCount');
    expect(f({ timesPerWeek: 9 }).timesPerWeek).toBe('validation.invalidCount');
  });

  it('une ValidationError levée dans un écran garde son champ', () => {
    const e = new ValidationError({ weightKg: 'validation.invalidWeight' });
    expect(isValidationError(e)).toBe(true);
    expect(e.fields.weightKg).toBe('validation.invalidWeight');
  });

  it('la note en autosave respecte la même limite qu’à la création', async () => {
    const db = await createTestDb();
    const id = await createNote(db, { title: 'T', content: 'ok' });
    await expect(saveNoteContent(db, id, 'T', 'x'.repeat(100_001))).rejects.toBeInstanceOf(
      ValidationError,
    );
    await saveNoteContent(db, id, ' Titre ', 'nouveau');
    expect(await getNote(db, id)).toMatchObject({ title: 'Titre', content: 'nouveau' });
    expect(noteInputSchema.shape.content.safeParse('x'.repeat(100_000)).success).toBe(true);
    db.close();
  });
});
