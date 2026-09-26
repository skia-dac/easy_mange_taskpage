import { notifyChange, write, type Db, type EntityWriter } from '@/shared/db';
import { toIsoDate, type IsoDate } from '@/shared/dates';
import { AppError } from '@/shared/errors';
import { fieldLimits } from '@/shared/fieldLimits';
import { enumOr, parseInput } from '@/shared/validation';

import {
  checkpointInputSchema,
  habitFrequencies,
  habitInputSchema,
  habitLogStatuses,
  missReasons,
  type Checkpoint,
  type CheckpointInput,
  type Habit,
  type HabitInput,
  type HabitLog,
  type HabitLogStatus,
  type MissReason,
} from '../domain/habit';

const ALIVE = 'deleted_at IS NULL';

type HabitRow = {
  id: string;
  name: string;
  icon: string;
  color_id: string;
  frequency: string;
  weekdays: string;
  times_per_week: number;
  target: number;
  unit: string | null;
  reminder_time: string | null;
  auto_study: number;
  tracks_body?: number;
  position: number;
};

type HabitLogRow = {
  id: string;
  habit_id: string;
  date: string;
  count: number;
  status: string;
  reason_code: string | null;
  reason: string | null;
  duration_minutes?: number | null;
};

function parseDays(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

const toHabit = (r: HabitRow): Habit => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  colorId: r.color_id,
  frequency: enumOr(habitFrequencies, r.frequency, 'daily'),
  weekdays: parseDays(r.weekdays),
  timesPerWeek: r.times_per_week,
  target: r.target,
  unit: r.unit,
  reminderTime: r.reminder_time,
  autoStudy: r.auto_study === 1,
  // Aussi dérivé de l'icône : la mise à jour de la migration 15 n'est pas passée par le serveur.
  tracksBody: r.tracks_body === 1 || r.icon === 'activity',
  position: r.position,
});

const toLog = (r: HabitLogRow): HabitLog => ({
  id: r.id,
  habitId: r.habit_id,
  date: r.date,
  count: r.count,
  status: enumOr(habitLogStatuses, r.status, 'done'),
  reasonCode: r.reason_code === null ? null : enumOr(missReasons, r.reason_code, 'other'),
  reason: r.reason,
  durationMinutes: r.duration_minutes ?? null,
});

function habitValues(input: HabitInput) {
  const v = parseInput(habitInputSchema, input);
  return {
    name: v.name,
    icon: v.icon,
    color_id: v.colorId,
    frequency: v.frequency,
    weekdays: JSON.stringify(v.frequency === 'weekdays' ? [...v.weekdays].sort() : []),
    times_per_week: v.frequency === 'weekly' ? v.timesPerWeek : 1,
    target: v.target,
    unit: v.target > 1 ? v.unit : null,
    reminder_time: v.reminderTime,
    auto_study: v.autoStudy ? 1 : 0,
    tracks_body: v.tracksBody ? 1 : 0,
  };
}

export async function listHabits(db: Db): Promise<Habit[]> {
  const rows = await db.getAllAsync<HabitRow>(
    `SELECT * FROM habits WHERE ${ALIVE} ORDER BY position, created_at`,
    [],
  );
  return rows.map(toHabit);
}

export async function getHabit(db: Db, id: string): Promise<Habit | null> {
  const row = await db.getFirstAsync<HabitRow>(`SELECT * FROM habits WHERE id = ? AND ${ALIVE}`, [
    id,
  ]);
  return row ? toHabit(row) : null;
}

/** Journal des habitudes entre deux dates incluses (toutes les habitudes, ou une seule). */
export async function listHabitLogs(
  db: Db,
  from: IsoDate,
  to: IsoDate,
  habitId?: string,
): Promise<HabitLog[]> {
  const rows = habitId
    ? await db.getAllAsync<HabitLogRow>(
        `SELECT * FROM habit_logs WHERE ${ALIVE} AND habit_id = ? AND date >= ? AND date <= ? ORDER BY date`,
        [habitId, from, to],
      )
    : await db.getAllAsync<HabitLogRow>(
        `SELECT * FROM habit_logs WHERE ${ALIVE} AND date >= ? AND date <= ? ORDER BY date`,
        [from, to],
      );
  return rows.map(toLog);
}

export async function createHabit(db: Db, input: HabitInput): Promise<string> {
  const values = habitValues(input);
  return write(db, async (w) => {
    const last = await w.db.getFirstAsync<{ p: number | null }>(
      `SELECT MAX(position) AS p FROM habits WHERE ${ALIVE}`,
      [],
    );
    return w.insert('habits', { ...values, position: (last?.p ?? -1) + 1 });
  });
}

export async function updateHabit(db: Db, id: string, input: HabitInput): Promise<void> {
  const values = habitValues(input);
  await write(db, (w) => w.update('habits', id, values));
}

/** Supprime l'habitude et tout son historique (à confirmer avant). */
export async function deleteHabit(db: Db, id: string): Promise<void> {
  await write(db, async (w) => {
    const logs = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM habit_logs WHERE ${ALIVE} AND habit_id = ?`,
      [id],
    );
    for (const l of logs) await w.softDelete('habit_logs', l.id);
    const points = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM habit_checkpoints WHERE ${ALIVE} AND habit_id = ?`,
      [id],
    );
    for (const c of points) await w.softDelete('habit_checkpoints', c.id);
    await w.softDelete('habits', id);
  });
}

async function currentLog(w: EntityWriter, habitId: string, date: IsoDate) {
  return w.db.getFirstAsync<HabitLogRow>(
    `SELECT * FROM habit_logs WHERE ${ALIVE} AND habit_id = ? AND date = ?`,
    [habitId, date],
  );
}

async function upsertLog(
  w: EntityWriter,
  habitId: string,
  date: IsoDate,
  values: {
    count: number;
    status: HabitLogStatus;
    reason_code: string | null;
    reason: string | null;
  },
): Promise<void> {
  const row = await currentLog(w, habitId, date);
  if (row) await w.update('habit_logs', row.id, values);
  else await w.insert('habit_logs', { habit_id: habitId, date, ...values });
}

async function targetOf(w: EntityWriter, habitId: string): Promise<number> {
  const h = await w.db.getFirstAsync<{ target: number }>('SELECT target FROM habits WHERE id = ?', [
    habitId,
  ]);
  return h?.target ?? 1;
}

/** Coche (objectif atteint) ou décoche une habitude pour un jour. */
export async function setHabitDone(
  db: Db,
  habitId: string,
  date: IsoDate,
  done: boolean,
): Promise<void> {
  await write(db, async (w) => {
    if (!done) {
      const row = await currentLog(w, habitId, date);
      if (row) await w.softDelete('habit_logs', row.id);
      return;
    }
    await upsertLog(w, habitId, date, {
      count: await targetOf(w, habitId),
      status: 'done',
      reason_code: null,
      reason: null,
    });
  });
}

/** +1 (ou −1) sur une habitude chiffrée (verres d'eau…). Ne descend jamais sous 0. */
export async function addHabitCount(
  db: Db,
  habitId: string,
  date: IsoDate,
  delta: number,
): Promise<void> {
  await write(db, async (w) => {
    const row = await currentLog(w, habitId, date);
    const count = Math.max(0, (row?.status === 'done' ? row.count : 0) + delta);
    if (count === 0 && row) {
      await w.softDelete('habit_logs', row.id);
      return;
    }
    if (count === 0) return;
    await upsertLog(w, habitId, date, { count, status: 'done', reason_code: null, reason: null });
  });
}

/** Note « pas fait » ou « excusé », avec une raison facultative. */
export async function setHabitMissed(
  db: Db,
  habitId: string,
  date: IsoDate,
  status: 'missed' | 'excused',
  reasonCode: MissReason | null = null,
  reason: string | null = null,
): Promise<void> {
  const text = reason?.trim() ? reason.trim().slice(0, fieldLimits.note200.max) : null;
  await write(db, (w) =>
    upsertLog(w, habitId, date, { count: 0, status, reason_code: reasonCode, reason: text }),
  );
}

/**
 * Appelé quand une session de révision se termine : coche les habitudes « Réviser »
 * (celles avec `auto_study`) pour ce jour, si elles ne le sont pas déjà.
 * À appeler DANS la transaction de fin de session.
 */
export async function markStudyHabits(w: EntityWriter, endedAt: string): Promise<void> {
  const date = toIsoDate(new Date(endedAt));
  const habits = await w.db.getAllAsync<{ id: string; target: number }>(
    `SELECT id, target FROM habits WHERE ${ALIVE} AND auto_study = 1`,
    [],
  );
  for (const h of habits) {
    const row = await currentLog(w, h.id, date);
    if (row?.status === 'done' && row.count >= h.target) continue;
    const count = row?.status === 'done' ? Math.min(h.target, row.count + 1) : 1;
    await upsertLog(w, h.id, date, { count, status: 'done', reason_code: null, reason: null });
  }
}

/** Change l'ordre d'affichage (liste d'ids dans le nouvel ordre). */
export async function reorderHabits(db: Db, ids: readonly string[]): Promise<void> {
  await write(db, async (w) => {
    for (const [i, id] of ids.entries()) await w.update('habits', id, { position: i });
  });
  notifyChange(['habits']);
}

/**
 * Durée d'une séance (facultative). Noter une durée coche aussi la journée si ce n'était pas
 * fait ; `null` efface seulement la durée.
 */
export async function setHabitDuration(
  db: Db,
  habitId: string,
  date: IsoDate,
  minutes: number | null,
): Promise<void> {
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60))
    throw new AppError('validation');
  await write(db, async (w) => {
    const row = await currentLog(w, habitId, date);
    if (row) {
      await w.update('habit_logs', row.id, {
        duration_minutes: minutes,
        ...(minutes !== null && row.status !== 'done'
          ? { status: 'done', count: await targetOf(w, habitId), reason_code: null, reason: null }
          : {}),
      });
      return;
    }
    if (minutes === null) return;
    await w.insert('habit_logs', {
      habit_id: habitId,
      date,
      count: await targetOf(w, habitId),
      status: 'done',
      reason_code: null,
      reason: null,
      duration_minutes: minutes,
    });
  });
}

type CheckpointRow = {
  id: string;
  habit_id: string;
  date: string;
  weight_kg: number | null;
  photo_path: string | null;
  note: string | null;
};

const toCheckpoint = (r: CheckpointRow): Checkpoint => ({
  id: r.id,
  habitId: r.habit_id,
  date: r.date,
  weightKg: r.weight_kg,
  photoPath: r.photo_path,
  note: r.note,
});

/** Points de suivi physique d'une habitude, du plus ancien (départ) au plus récent. */
export async function listCheckpoints(db: Db, habitId: string): Promise<Checkpoint[]> {
  const rows = await db.getAllAsync<CheckpointRow>(
    `SELECT * FROM habit_checkpoints WHERE ${ALIVE} AND habit_id = ? ORDER BY date, created_at`,
    [habitId],
  );
  return rows.map(toCheckpoint);
}

export async function getCheckpoint(db: Db, id: string): Promise<Checkpoint | null> {
  const row = await db.getFirstAsync<CheckpointRow>(
    `SELECT * FROM habit_checkpoints WHERE ${ALIVE} AND id = ?`,
    [id],
  );
  return row ? toCheckpoint(row) : null;
}

function checkpointValues(input: CheckpointInput) {
  const v = parseInput(checkpointInputSchema, input);
  return {
    habit_id: v.habitId,
    date: v.date,
    weight_kg: v.weightKg,
    photo_path: v.photoPath,
    note: v.note,
  };
}

export async function createCheckpoint(db: Db, input: CheckpointInput): Promise<string> {
  const values = checkpointValues(input);
  return write(db, (w) => w.insert('habit_checkpoints', values));
}

export async function updateCheckpoint(db: Db, id: string, input: CheckpointInput): Promise<void> {
  const values = checkpointValues(input);
  await write(db, (w) => w.update('habit_checkpoints', id, values));
}

/** Supprime un point (le fichier photo, lui, est effacé par l'écran). */
export async function deleteCheckpoint(db: Db, id: string): Promise<void> {
  await write(db, (w) => w.softDelete('habit_checkpoints', id));
}
