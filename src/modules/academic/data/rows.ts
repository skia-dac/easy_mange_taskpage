import { enumOr } from '@/shared/validation';
import { courseTypes, recurrences, type CourseSeries } from '../domain/course';
import type { Exam } from '../domain/exam';
import { exceptionKinds, type CourseException } from '../domain/exception';
import { offPeriodKinds, type OffPeriod } from '../domain/offPeriod';
import type { Subject } from '../domain/subject';
import { timetableKinds, type Timetable } from '../domain/timetable';

export type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  teacher: string | null;
  room: string | null;
  color_id: string;
  semester: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export const toSubject = (r: SubjectRow): Subject => ({
  id: r.id,
  name: r.name,
  code: r.code,
  teacher: r.teacher,
  room: r.room,
  colorId: r.color_id,
  semester: r.semester,
  description: r.description,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export type TimetableRow = {
  id: string;
  name: string;
  valid_from: string;
  valid_until: string;
  kind: string;
};

export const toTimetable = (r: TimetableRow): Timetable => ({
  id: r.id,
  name: r.name,
  validFrom: r.valid_from,
  validUntil: r.valid_until,
  kind: enumOr(timetableKinds, r.kind, 'courses'),
});

export type CourseSeriesRow = {
  id: string;
  subject_id: string;
  timetable_id: string | null;
  title: string | null;
  teacher: string | null;
  room: string | null;
  course_type: string;
  weekday: number;
  start_time: string;
  end_time: string;
  valid_from: string;
  valid_until: string;
  recurrence: string;
  description: string | null;
  reminder_minutes: number | null;
};

export const toCourseSeries = (r: CourseSeriesRow): CourseSeries => ({
  id: r.id,
  subjectId: r.subject_id,
  timetableId: r.timetable_id,
  title: r.title,
  teacher: r.teacher,
  room: r.room,
  courseType: enumOr(courseTypes, r.course_type, 'lecture'),
  weekday: r.weekday,
  startTime: r.start_time,
  endTime: r.end_time,
  validFrom: r.valid_from,
  validUntil: r.valid_until,
  recurrence: enumOr(recurrences, r.recurrence, 'weekly'),
  description: r.description,
  reminderMinutes: r.reminder_minutes,
});

export type ExamRow = {
  id: string;
  subject_id: string;
  title: string | null;
  date: string;
  time: string | null;
  duration_minutes: number | null;
  room: string | null;
  description: string | null;
  reminder_days: string;
  reminder_time: string;
  grade: number | null;
  grade_max: number;
  coefficient: number;
  timetable_id: string | null;
};

function parseDays(json: string): number[] {
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export const toExam = (r: ExamRow): Exam => ({
  id: r.id,
  subjectId: r.subject_id,
  title: r.title,
  date: r.date,
  time: r.time,
  durationMinutes: r.duration_minutes,
  room: r.room,
  description: r.description,
  reminderDays: parseDays(r.reminder_days),
  reminderTime: r.reminder_time,
  grade: r.grade,
  gradeMax: r.grade_max,
  coefficient: r.coefficient,
  timetableId: r.timetable_id,
});

export type CourseExceptionRow = {
  id: string;
  series_id: string;
  date: string;
  kind: string;
  new_date: string | null;
  new_start_time: string | null;
  new_end_time: string | null;
  new_room: string | null;
  new_teacher: string | null;
  new_title: string | null;
  note: string | null;
};

export const toCourseException = (r: CourseExceptionRow): CourseException => ({
  id: r.id,
  seriesId: r.series_id,
  date: r.date,
  kind: enumOr(exceptionKinds, r.kind, 'modified'),
  newDate: r.new_date ?? null,
  newStartTime: r.new_start_time,
  newEndTime: r.new_end_time,
  newRoom: r.new_room,
  newTeacher: r.new_teacher,
  newTitle: r.new_title,
  note: r.note,
});

export type OffPeriodRow = {
  id: string;
  name: string;
  kind: string;
  start_date: string;
  end_date: string;
  suspend_courses: number;
};

export const toOffPeriod = (r: OffPeriodRow): OffPeriod => ({
  id: r.id,
  name: r.name,
  kind: enumOr(offPeriodKinds, r.kind, 'holiday'),
  startDate: r.start_date,
  endDate: r.end_date,
  suspendCourses: r.suspend_courses === 1,
});
