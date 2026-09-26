import type { IsoDate } from '@/shared/dates';
import { write, type Db } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { moodLogInputSchema, type MoodLog, type MoodLogInput } from '../domain/mood';

type MoodLogRow = { id: string; date: string; mood: number; energy: number; note: string | null };

const ALIVE = 'deleted_at IS NULL';

const toMoodLog = (r: MoodLogRow): MoodLog => ({
  id: r.id,
  date: r.date,
  mood: r.mood,
  energy: r.energy,
  note: r.note,
});

export async function getMoodLog(db: Db, date: IsoDate): Promise<MoodLog | null> {
  const row = await db.getFirstAsync<MoodLogRow>(
    `SELECT * FROM mood_logs WHERE ${ALIVE} AND date = ? ORDER BY updated_at DESC`,
    [date],
  );
  return row ? toMoodLog(row) : null;
}

/** Entrées d'humeur entre deux dates (incluses). */
export async function listMoodLogs(db: Db, from: IsoDate, to: IsoDate): Promise<MoodLog[]> {
  const rows = await db.getAllAsync<MoodLogRow>(
    `SELECT * FROM mood_logs WHERE ${ALIVE} AND date >= ? AND date <= ? ORDER BY date`,
    [from, to],
  );
  // Une seule entrée par jour, même si deux appareils en ont créé une chacun.
  const byDate = new Map<string, MoodLog>();
  for (const r of rows) byDate.set(r.date, toMoodLog(r));
  return [...byDate.values()];
}

/** Enregistre l'humeur du jour : une entrée par date, remplacée si elle existe. */
export async function saveMoodLog(db: Db, input: MoodLogInput): Promise<string> {
  const v = parseInput(moodLogInputSchema, input);
  return write(db, async (w) => {
    const current = await w.db.getFirstAsync<{ id: string }>(
      `SELECT id FROM mood_logs WHERE ${ALIVE} AND date = ?`,
      [v.date],
    );
    const values = { date: v.date, mood: v.mood, energy: v.energy, note: v.note };
    if (current) {
      await w.update('mood_logs', current.id, values);
      return current.id;
    }
    return w.insert('mood_logs', values);
  });
}

export async function deleteMoodLog(db: Db, id: string) {
  return write(db, (w) => w.softDelete('mood_logs', id));
}
