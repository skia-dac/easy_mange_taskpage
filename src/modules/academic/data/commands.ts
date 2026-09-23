import { write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { courseInputSchema, type CourseInput } from '../domain/course';
import { examInputSchema, type ExamInput } from '../domain/exam';
import { subjectInputSchema, type SubjectInput } from '../domain/subject';
import { timetableInputSchema, type TimetableInput } from '../domain/timetable';

// ---- Matières ----
function subjectValues(input: SubjectInput) {
  const v = parseInput(subjectInputSchema, input);
  return {
    name: v.name,
    code: v.code,
    teacher: v.teacher,
    room: v.room,
    color_id: v.colorId,
    semester: v.semester,
    description: v.description,
  };
}

export async function createSubject(db: Db, input: SubjectInput) {
  const values = subjectValues(input);
  return write(db, (w) => w.insert('subjects', values));
}

export async function updateSubject(db: Db, id: string, input: SubjectInput) {
  const values = subjectValues(input);
  return write(db, (w) => w.update('subjects', id, values));
}

/** À appeler dans une transaction existante (voir workflows/deleteSubject). */
export async function removeSubjectAndCourses(w: EntityWriter, subjectId: string) {
  const series = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM course_series WHERE subject_id = ? AND deleted_at IS NULL',
    [subjectId],
  );
  for (const s of series) await w.softDelete('course_series', s.id);
  await w.softDelete('subjects', subjectId);
}

// ---- Emplois du temps ----
function timetableValues(input: TimetableInput) {
  const v = parseInput(timetableInputSchema, input);
  return { name: v.name, valid_from: v.validFrom, valid_until: v.validUntil };
}

export async function createTimetable(db: Db, input: TimetableInput) {
  const values = timetableValues(input);
  return write(db, (w) => w.insert('timetables', values));
}

export async function updateTimetable(db: Db, id: string, input: TimetableInput) {
  const values = timetableValues(input);
  return write(db, (w) => w.update('timetables', id, values));
}

/** Supprime l'emploi du temps ET ses cours (l'écran demande confirmation avant). */
export async function deleteTimetable(db: Db, id: string) {
  return write(db, async (w) => {
    const series = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM course_series WHERE timetable_id = ? AND deleted_at IS NULL',
      [id],
    );
    for (const s of series) await w.softDelete('course_series', s.id);
    await w.softDelete('timetables', id);
  });
}

// ---- Cours ----
function courseValues(input: CourseInput) {
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
  };
}

export async function createCourse(db: Db, input: CourseInput) {
  const values = courseValues(input);
  return write(db, (w) => w.insert('course_series', values));
}

/** Phase 1 : modifie toute la série. Les options « ce cours seulement / et les suivants » arrivent en phase 4. */
export async function updateCourse(db: Db, id: string, input: CourseInput) {
  const values = courseValues(input);
  return write(db, (w) => w.update('course_series', id, values));
}

export async function deleteCourse(db: Db, id: string) {
  return write(db, async (w) => {
    const exceptions = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM course_exceptions WHERE series_id = ? AND deleted_at IS NULL',
      [id],
    );
    for (const e of exceptions) await w.softDelete('course_exceptions', e.id);
    await w.softDelete('course_series', id);
  });
}

// ---- Examens ----
function examValues(input: ExamInput) {
  const v = parseInput(examInputSchema, input);
  return {
    subject_id: v.subjectId,
    title: v.title,
    date: v.date,
    time: v.time,
    duration_minutes: v.durationMinutes,
    room: v.room,
    description: v.description,
  };
}

export async function createExam(db: Db, input: ExamInput) {
  const values = examValues(input);
  return write(db, (w) => w.insert('exams', values));
}

export async function updateExam(db: Db, id: string, input: ExamInput) {
  const values = examValues(input);
  return write(db, (w) => w.update('exams', id, values));
}

export async function deleteExam(db: Db, id: string) {
  return write(db, (w) => w.softDelete('exams', id));
}
