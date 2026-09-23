import type { Db } from '@/shared/db';

import {
  toCourseSeries,
  toExam,
  toSubject,
  toTimetable,
  type CourseSeriesRow,
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
