import { z } from 'zod';

import { type IsoDate } from '@/shared/dates';
import { fieldLimits } from '@/shared/fieldLimits';
import { isoDate, optionalText } from '@/shared/validation';

/** Journal d'humeur et d'énergie : une entrée par jour, deux notes de 1 à 5. */
export const moodLevels = [1, 2, 3, 4, 5] as const;

const level = z
  .number({ error: 'validation.required' })
  .int()
  .min(1, { error: 'validation.required' })
  .max(5, { error: 'validation.required' });

export const moodLogInputSchema = z.object({
  date: isoDate,
  mood: level,
  energy: level,
  note: optionalText(fieldLimits.note500.max),
});

export type MoodLogInput = z.input<typeof moodLogInputSchema>;
export type MoodLog = z.output<typeof moodLogInputSchema> & { id: string };

/** Emoji affiché pour chaque niveau d'humeur (1 = très bas … 5 = très bien). */
export const moodEmoji: Record<number, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
export const energyEmoji: Record<number, string> = { 1: '🪫', 2: '😴', 3: '🙂', 4: '💪', 5: '⚡' };

const average = (values: readonly number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

export type MoodSummary = {
  days: number;
  mood: number | null;
  energy: number | null;
};

/** Moyennes d'humeur et d'énergie sur les entrées données. */
export function summarizeMood(logs: readonly MoodLog[]): MoodSummary {
  return {
    days: logs.length,
    mood: average(logs.map((l) => l.mood)),
    energy: average(logs.map((l) => l.energy)),
  };
}

export type MoodCorrelation = {
  /** Énergie moyenne les jours où l'habitude est faite / manquée (null = pas assez de données). */
  energyDone: number | null;
  energyMissed: number | null;
  moodDone: number | null;
  moodMissed: number | null;
};

/**
 * Lien habitude ↔ humeur : moyenne de l'humeur et de l'énergie les jours où l'habitude a été
 * faite, et ceux où elle ne l'a pas été. Il faut au moins 2 jours de chaque côté.
 */
export function moodByHabit(
  logs: readonly MoodLog[],
  doneDays: ReadonlySet<IsoDate>,
): MoodCorrelation {
  const done = logs.filter((l) => doneDays.has(l.date));
  const missed = logs.filter((l) => !doneDays.has(l.date));
  const ok = done.length >= 2 && missed.length >= 2;
  return {
    energyDone: ok ? average(done.map((l) => l.energy)) : null,
    energyMissed: ok ? average(missed.map((l) => l.energy)) : null,
    moodDone: ok ? average(done.map((l) => l.mood)) : null,
    moodMissed: ok ? average(missed.map((l) => l.mood)) : null,
  };
}
