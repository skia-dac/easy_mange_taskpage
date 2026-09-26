import { addDaysIso, type IsoDate } from '@/shared/dates';
import { write, type Db, type EntityWriter, type Values } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { parseInput, ValidationError } from '@/shared/validation';

import type { CourseInput } from '../domain/course';
import {
  occurrenceOverrideSchema,
  overrideEndAfterStart,
  type OccurrenceOverrideInput,
} from '../domain/exception';
import { offPeriodInputSchema, type OffPeriodInput } from '../domain/offPeriod';
import { courseValues, removeCourse } from './commands';
import { toCourseSeries, type CourseSeriesRow } from './rows';

/** Portée d'une modification ou suppression sur un cours récurrent (§27, §28). */
export type EditScope = 'this' | 'following' | 'all';

async function existingException(w: EntityWriter, seriesId: string, date: IsoDate) {
  return w.db.getFirstAsync<{ id: string }>(
    'SELECT id FROM course_exceptions WHERE series_id = ? AND date = ? AND deleted_at IS NULL',
    [seriesId, date],
  );
}

async function upsertException(w: EntityWriter, seriesId: string, date: IsoDate, values: Values) {
  const current = await existingException(w, seriesId, date);
  if (current) await w.update('course_exceptions', current.id, values);
  else await w.insert('course_exceptions', { series_id: seriesId, date, ...values });
}

async function loadSeries(w: EntityWriter, seriesId: string) {
  const row = await w.db.getFirstAsync<CourseSeriesRow>(
    'SELECT * FROM course_series WHERE id = ? AND deleted_at IS NULL',
    [seriesId],
  );
  if (!row) throw new AppError('notFound');
  return toCourseSeries(row);
}

/** Marque UNE séance comme annulée : elle reste visible, barrée (§29). Tout ajustement antérieur est effacé. */
export async function cancelOccurrence(db: Db, seriesId: string, date: IsoDate) {
  return write(db, (w) =>
    upsertException(w, seriesId, date, {
      kind: 'cancelled',
      new_date: null,
      new_start_time: null,
      new_end_time: null,
      new_room: null,
      new_teacher: null,
      new_title: null,
      note: null,
    }),
  );
}

/** Retire l'exception d'une séance : elle redevient comme la série. */
export async function restoreOccurrence(db: Db, seriesId: string, date: IsoDate) {
  return write(db, async (w) => {
    const current = await existingException(w, seriesId, date);
    if (current) await w.softDelete('course_exceptions', current.id);
  });
}

/**
 * Modifie UNE séance (option 1 de §27). Les heures laissées vides reprennent celles de la série :
 * on vérifie donc fin > début sur les heures effectives (nouvelle heure ou heure de la série).
 */
export async function overrideOccurrence(db: Db, input: OccurrenceOverrideInput) {
  const v = parseInput(occurrenceOverrideSchema, input);
  return write(db, async (w) => {
    const series = await loadSeries(w, v.seriesId);
    if (!overrideEndAfterStart(series, v)) {
      throw new ValidationError({ newEndTime: 'validation.endAfterStart' });
    }
    await upsertException(w, v.seriesId, v.date, {
      kind: 'modified',
      ...(v.newDate === undefined ? {} : { new_date: v.newDate === v.date ? null : v.newDate }),
      new_start_time: v.newStartTime,
      new_end_time: v.newEndTime,
      new_room: v.newRoom,
      new_teacher: v.newTeacher,
      new_title: v.newTitle,
      note: v.note,
    });
  });
}

/**
 * « Ce cours et les suivants » (option 2 de §27) : la série actuelle s'arrête la veille de `date`,
 * une nouvelle série commence à `date` avec les nouvelles valeurs. Les exceptions à partir de `date`
 * suivent la nouvelle série. Tout dans une seule transaction.
 * @returns l'id de la nouvelle série
 */
export async function splitSeries(
  db: Db,
  seriesId: string,
  date: IsoDate,
  input: CourseInput,
): Promise<string> {
  return write(db, (w) => splitSeriesIn(w, seriesId, date, input));
}

/**
 * Même chose dans une transaction existante (voir workflows/splitSeriesEverywhere, qui fait aussi
 * suivre les notes prises à partir de `date`). Retourne l'id de la série qui porte `date`.
 */
export async function splitSeriesIn(
  w: EntityWriter,
  seriesId: string,
  date: IsoDate,
  input: CourseInput,
): Promise<string> {
  const values = courseValues({ ...input, startDate: date });
  const current = await loadSeries(w, seriesId);
  if (date <= current.validFrom) {
    // Rien avant cette date : c'est toute la série qui change.
    await w.update('course_series', seriesId, values);
    return seriesId;
  }
  await w.update('course_series', seriesId, { valid_until: addDaysIso(date, -1) });
  const newId = await w.insert('course_series', values);
  const moved = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM course_exceptions WHERE series_id = ? AND date >= ? AND deleted_at IS NULL',
    [seriesId, date],
  );
  for (const e of moved) await w.update('course_exceptions', e.id, { series_id: newId });
  return newId;
}

/** « Ce cours et les suivants » pour une suppression (§28) : la série s'arrête la veille. */
export async function endSeriesBefore(db: Db, seriesId: string, date: IsoDate) {
  return write(db, (w) => endSeriesBeforeIn(w, seriesId, date));
}

/**
 * Même chose dans une transaction existante. Si rien ne précède `date`, c'est toute la série qui
 * disparaît, exceptions comprises (`removeCourse`). Retourne `true` dans ce cas.
 */
export async function endSeriesBeforeIn(
  w: EntityWriter,
  seriesId: string,
  date: IsoDate,
): Promise<boolean> {
  const current = await loadSeries(w, seriesId);
  if (date <= current.validFrom) {
    await removeCourse(w, seriesId);
    return true;
  }
  await w.update('course_series', seriesId, { valid_until: addDaysIso(date, -1) });
  const later = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM course_exceptions WHERE series_id = ? AND date >= ? AND deleted_at IS NULL',
    [seriesId, date],
  );
  for (const e of later) await w.softDelete('course_exceptions', e.id);
  return false;
}

// ---- Vacances et jours sans cours ----
function offPeriodValues(input: OffPeriodInput): Values {
  const v = parseInput(offPeriodInputSchema, input);
  return {
    name: v.name,
    kind: v.kind,
    start_date: v.startDate,
    end_date: v.endDate,
    suspend_courses: v.suspendCourses ? 1 : 0,
  };
}

export async function createOffPeriod(db: Db, input: OffPeriodInput) {
  const values = offPeriodValues(input);
  return write(db, (w) => w.insert('off_periods', values));
}

export async function updateOffPeriod(db: Db, id: string, input: OffPeriodInput) {
  const values = offPeriodValues(input);
  return write(db, (w) => w.update('off_periods', id, values));
}

export async function deleteOffPeriod(db: Db, id: string) {
  return write(db, (w) => w.softDelete('off_periods', id));
}
