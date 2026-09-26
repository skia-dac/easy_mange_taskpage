import type { IsoDate } from '@/shared/dates';
import { write, type Db, type EntityWriter, type Values } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { courseInputSchema, type CourseInput } from '../domain/course';
import { examSchema, type ExamInput } from '../domain/exam';
import { subjectInputSchema, type SubjectInput } from '../domain/subject';
import { timetableInputSchema, type TimetableInput, type TimetableKind } from '../domain/timetable';

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
  for (const s of series) await removeCourse(w, s.id);
  await w.softDelete('subjects', subjectId);
}

/** Supprime un cours et ses exceptions (annulations, séances modifiées). */
export async function removeCourse(w: EntityWriter, id: string) {
  const exceptions = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM course_exceptions WHERE series_id = ? AND deleted_at IS NULL',
    [id],
  );
  for (const e of exceptions) await w.softDelete('course_exceptions', e.id);
  await w.softDelete('course_series', id);
}

// ---- Emplois du temps ----
function timetableValues(input: TimetableInput) {
  const v = parseInput(timetableInputSchema, input);
  return { name: v.name, valid_from: v.validFrom, valid_until: v.validUntil, kind: v.kind };
}

export async function createTimetable(db: Db, input: TimetableInput) {
  const values = timetableValues(input);
  return write(db, (w) => w.insert('timetables', values));
}

export async function updateTimetable(db: Db, id: string, input: TimetableInput) {
  const values = timetableValues(input);
  return write(db, (w) => w.update('timetables', id, values));
}

/**
 * Emploi du temps d'un type donné qui couvre `from` → `to` : on prend celui qui chevauche la
 * période (et on l'agrandit si besoin), sinon on en crée un. Retourne son id.
 */
export async function ensureTimetable(
  w: EntityWriter,
  kind: TimetableKind,
  from: IsoDate,
  to: IsoDate,
  name: string,
): Promise<string> {
  const row = await w.db.getFirstAsync<{ id: string; valid_from: string; valid_until: string }>(
    `SELECT id, valid_from, valid_until FROM timetables
     WHERE deleted_at IS NULL AND kind = ? AND valid_from <= ? AND valid_until >= ?
     ORDER BY valid_from DESC`,
    [kind, to, from],
  );
  if (!row) {
    const values = timetableValues({ name, kind, validFrom: from, validUntil: to });
    return w.insert('timetables', values);
  }
  const patch: Values = {};
  if (from < row.valid_from) patch.valid_from = from;
  if (to > row.valid_until) patch.valid_until = to;
  if (Object.keys(patch).length) await w.update('timetables', row.id, patch);
  return row.id;
}

/** Séries de cours (vivantes) rattachées à un emploi du temps. */
export async function seriesIdsOfTimetable(w: EntityWriter, timetableId: string) {
  const rows = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM course_series WHERE timetable_id = ? AND deleted_at IS NULL',
    [timetableId],
  );
  return rows.map((r) => r.id);
}

/**
 * Supprime l'emploi du temps ET ses cours (exceptions comprises), dans une transaction existante.
 * Voir aussi `deleteTimetableEverywhere` (workflows) : détache en plus les notes des cours.
 */
export async function removeTimetable(w: EntityWriter, id: string) {
  for (const seriesId of await seriesIdsOfTimetable(w, id)) await removeCourse(w, seriesId);
  // Examens et révisions rattachés : on les garde, simplement détachés de cet emploi du temps.
  const exams = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM exams WHERE timetable_id = ? AND deleted_at IS NULL',
    [id],
  );
  for (const e of exams) await w.update('exams', e.id, { timetable_id: null });
  const blocks = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM revision_blocks WHERE timetable_id = ? AND deleted_at IS NULL',
    [id],
  );
  for (const b of blocks) await w.update('revision_blocks', b.id, { timetable_id: null });
  await w.softDelete('timetables', id);
}

/** Supprime l'emploi du temps ET ses cours (l'écran demande confirmation avant). */
export async function deleteTimetable(db: Db, id: string) {
  return write(db, (w) => removeTimetable(w, id));
}

// ---- Cours ----
/** Colonnes d'une série de cours à partir de la saisie validée (partagé avec exceptionCommands). */
export function courseValues(input: CourseInput) {
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

export async function createCourse(db: Db, input: CourseInput) {
  const values = courseValues(input);
  return write(db, (w) => w.insert('course_series', values));
}

/** Phase 1 : modifie toute la série. Les options « ce cours seulement / et les suivants » arrivent en phase 4. */
export async function updateCourse(db: Db, id: string, input: CourseInput) {
  const values = courseValues(input);
  return write(db, (w) => w.update('course_series', id, values));
}

/** Voir aussi `deleteCourseEverywhere` (workflows) : détache en plus les notes du cours. */
export async function deleteCourse(db: Db, id: string) {
  return write(db, (w) => removeCourse(w, id));
}

// ---- Examens ----
function examValues(input: ExamInput) {
  const v = parseInput(examSchema, input);
  return {
    subject_id: v.subjectId,
    title: v.title,
    date: v.date,
    time: v.time,
    duration_minutes: v.durationMinutes,
    room: v.room,
    description: v.description,
    reminder_days: JSON.stringify(v.reminderDays),
    reminder_time: v.reminderTime,
    grade: v.grade,
    grade_max: v.gradeMax,
    coefficient: v.coefficient,
    timetable_id: v.timetableId,
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
  return write(db, async (w) => {
    // Les révisions prévues restent dans le calendrier, simplement détachées de l'examen.
    const blocks = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM revision_blocks WHERE exam_id = ? AND deleted_at IS NULL',
      [id],
    );
    for (const b of blocks) await w.update('revision_blocks', b.id, { exam_id: null });
    await w.softDelete('exams', id);
  });
}
