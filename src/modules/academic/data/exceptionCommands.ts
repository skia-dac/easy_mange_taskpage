import { addDaysIso, type IsoDate } from '@/shared/dates';
import { write, type Db, type EntityWriter, type Values } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { parseInput } from '@/shared/validation';

import { courseInputSchema, type CourseInput } from '../domain/course';
import { occurrenceOverrideSchema, type OccurrenceOverrideInput } from '../domain/exception';
import { offPeriodInputSchema, type OffPeriodInput } from '../domain/offPeriod';
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

/** Marque UNE séance comme annulée : elle reste visible, barrée (§29). */
export async function cancelOccurrence(db: Db, seriesId: string, date: IsoDate) {
  return write(db, (w) =>
    upsertException(w, seriesId, date, {
      kind: 'cancelled',
      new_start_time: null,
      new_end_time: null,
      new_room: null,
      new_teacher: null,
      new_title: null,
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

/** Modifie UNE séance (option 1 de §27). */
export async function overrideOccurrence(db: Db, input: OccurrenceOverrideInput) {
  const v = parseInput(occurrenceOverrideSchema, input);
  return write(db, (w) =>
    upsertException(w, v.seriesId, v.date, {
      kind: 'modified',
      new_start_time: v.newStartTime,
      new_end_time: v.newEndTime,
      new_room: v.newRoom,
      new_teacher: v.newTeacher,
      new_title: v.newTitle,
      note: v.note,
    }),
  );
}

function seriesValues(input: CourseInput): Values {
  const v = parseInput(courseInputSchema, input);
  return {
    subject_id: v.subjectId,
    timetable_id: v.timetableId,
    title: v.title,
    teacher: v.teacher,
    room: v.room,
    course_type: v.courseType,
    weekday: v.weekday,
    start_time: v.startTime,
    end_time: v.endTime,
    valid_from: v.validFrom,
    valid_until: v.validUntil,
    recurrence: v.recurrence,
    description: v.description,
    reminder_minutes: v.reminderMinutes,
  };
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
  const values = seriesValues({ ...input, startDate: date });
  return write(db, async (w) => {
    const row = await w.db.getFirstAsync<CourseSeriesRow>(
      'SELECT * FROM course_series WHERE id = ? AND deleted_at IS NULL',
      [seriesId],
    );
    if (!row) throw new AppError('notFound');
    const current = toCourseSeries(row);
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
  });
}

/** « Ce cours et les suivants » pour une suppression (§28) : la série s'arrête la veille. */
export async function endSeriesBefore(db: Db, seriesId: string, date: IsoDate) {
  return write(db, async (w) => {
    const row = await w.db.getFirstAsync<{ valid_from: string }>(
      'SELECT valid_from FROM course_series WHERE id = ? AND deleted_at IS NULL',
      [seriesId],
    );
    if (!row) throw new AppError('notFound');
    if (date <= row.valid_from) {
      await w.softDelete('course_series', seriesId);
      return;
    }
    await w.update('course_series', seriesId, { valid_until: addDaysIso(date, -1) });
    const later = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM course_exceptions WHERE series_id = ? AND date >= ? AND deleted_at IS NULL',
      [seriesId, date],
    );
    for (const e of later) await w.softDelete('course_exceptions', e.id);
  });
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
