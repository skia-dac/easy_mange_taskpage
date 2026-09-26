import type { Db } from '@/shared/db';

import {
  toCourseException,
  toCourseSeries,
  toOffPeriod,
  toExam,
  toSubject,
  toTimetable,
  type CourseExceptionRow,
  type CourseSeriesRow,
  type OffPeriodRow,
  type ExamRow,
  type SubjectRow,
  type TimetableRow,
} from './rows';

const ALIVE = 'deleted_at IS NULL';

export async function listSubjects(db: Db) {
  const rows = await db.getAllAsync<SubjectRow>(
    `SELECT * FROM subjects WHERE ${ALIVE} ORDER BY name COLLATE NOCASE`,
    [],
  );
  return rows.map(toSubject);
}

export async function getSubject(db: Db, id: string) {
  const row = await db.getFirstAsync<SubjectRow>(
    `SELECT * FROM subjects WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toSubject(row) : null;
}

export async function listTimetables(db: Db) {
  const rows = await db.getAllAsync<TimetableRow>(
    `SELECT * FROM timetables WHERE ${ALIVE} ORDER BY valid_from`,
    [],
  );
  return rows.map(toTimetable);
}

export async function getTimetable(db: Db, id: string) {
  const row = await db.getFirstAsync<TimetableRow>(
    `SELECT * FROM timetables WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toTimetable(row) : null;
}

export async function listCourseSeries(
  db: Db,
  filter: { subjectId?: string; timetableId?: string } = {},
) {
  const where = [ALIVE];
  const params: string[] = [];
  if (filter.subjectId) {
    where.push('subject_id = ?');
    params.push(filter.subjectId);
  }
  if (filter.timetableId) {
    where.push('timetable_id = ?');
    params.push(filter.timetableId);
  }
  const rows = await db.getAllAsync<CourseSeriesRow>(
    `SELECT * FROM course_series WHERE ${where.join(' AND ')} ORDER BY weekday, start_time`,
    params,
  );
  return rows.map(toCourseSeries);
}

export async function getCourseSeries(db: Db, id: string) {
  const row = await db.getFirstAsync<CourseSeriesRow>(
    `SELECT * FROM course_series WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toCourseSeries(row) : null;
}

export async function listExams(db: Db, filter: { subjectId?: string } = {}) {
  const rows = filter.subjectId
    ? await db.getAllAsync<ExamRow>(
        `SELECT * FROM exams WHERE ${ALIVE} AND subject_id = ? ORDER BY date, time`,
        [filter.subjectId],
      )
    : await db.getAllAsync<ExamRow>(`SELECT * FROM exams WHERE ${ALIVE} ORDER BY date, time`, []);
  return rows.map(toExam);
}

export async function getExam(db: Db, id: string) {
  const row = await db.getFirstAsync<ExamRow>(`SELECT * FROM exams WHERE id = ? AND ${ALIVE}`, [
    id,
  ]);
  return row ? toExam(row) : null;
}

export async function listCourseExceptions(db: Db, filter: { seriesId?: string } = {}) {
  const rows = filter.seriesId
    ? await db.getAllAsync<CourseExceptionRow>(
        `SELECT * FROM course_exceptions WHERE ${ALIVE} AND series_id = ? ORDER BY date`,
        [filter.seriesId],
      )
    : await db.getAllAsync<CourseExceptionRow>(
        `SELECT * FROM course_exceptions WHERE ${ALIVE} ORDER BY date`,
        [],
      );
  return rows.map(toCourseException);
}

export async function getCourseException(db: Db, seriesId: string, date: string) {
  const row = await db.getFirstAsync<CourseExceptionRow>(
    `SELECT * FROM course_exceptions WHERE ${ALIVE} AND series_id = ? AND date = ?`,
    [seriesId, date],
  );
  return row ? toCourseException(row) : null;
}

export async function listOffPeriods(db: Db) {
  const rows = await db.getAllAsync<OffPeriodRow>(
    `SELECT * FROM off_periods WHERE ${ALIVE} ORDER BY start_date`,
    [],
  );
  return rows.map(toOffPeriod);
}

export async function getOffPeriod(db: Db, id: string) {
  const row = await db.getFirstAsync<OffPeriodRow>(
    `SELECT * FROM off_periods WHERE id = ? AND ${ALIVE}`,
    [id],
  );
  return row ? toOffPeriod(row) : null;
}

/** Nettoie une saisie pour un LIKE : pas de jokers venant de l'utilisateur. */
export function likePattern(query: string): string {
  return `%${query.trim().replace(/[%_\\]/g, '')}%`;
}

export async function searchSubjects(db: Db, query: string) {
  const q = likePattern(query);
  const rows = await db.getAllAsync<SubjectRow>(
    `SELECT * FROM subjects WHERE ${ALIVE} AND (name LIKE ? OR code LIKE ? OR teacher LIKE ?) ORDER BY name COLLATE NOCASE LIMIT 20`,
    [q, q, q],
  );
  return rows.map(toSubject);
}

/** Cours dont le titre, la salle, le prof. ou le nom de la matière correspond. */
export async function searchCourseSeries(db: Db, query: string) {
  const q = likePattern(query);
  const rows = await db.getAllAsync<CourseSeriesRow>(
    `SELECT c.* FROM course_series c JOIN subjects s ON s.id = c.subject_id
     WHERE c.deleted_at IS NULL AND s.deleted_at IS NULL
       AND (c.title LIKE ? OR c.room LIKE ? OR c.teacher LIKE ? OR s.name LIKE ?)
     ORDER BY c.weekday, c.start_time LIMIT 20`,
    [q, q, q, q],
  );
  return rows.map(toCourseSeries);
}

export async function searchExams(db: Db, query: string) {
  const q = likePattern(query);
  const rows = await db.getAllAsync<ExamRow>(
    `SELECT e.* FROM exams e JOIN subjects s ON s.id = e.subject_id
     WHERE e.deleted_at IS NULL AND s.deleted_at IS NULL
       AND (e.title LIKE ? OR e.room LIKE ? OR e.description LIKE ? OR s.name LIKE ?)
     ORDER BY e.date LIMIT 20`,
    [q, q, q, q],
  );
  return rows.map(toExam);
}
