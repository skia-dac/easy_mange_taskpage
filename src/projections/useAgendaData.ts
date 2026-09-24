import {
  listCourseExceptions,
  listCourseSeries,
  listExams,
  listOffPeriods,
} from '@/modules/academic';
import {
  getActiveStudySession,
  listHabitLogs,
  listHabits,
  listPersonalEvents,
  listWorkItems,
} from '@/modules/productivity';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useLiveQuery, type Db } from '@/shared/db';

import type { TodayData } from './today';

const TABLES = [
  'course_series',
  'course_exceptions',
  'off_periods',
  'exams',
  'tasks',
  'assignments',
  'personal_events',
  'study_sessions',
  'habits',
  'habit_logs',
] as const;

async function loadAgenda(db: Db): Promise<TodayData> {
  const today = toIsoDate(new Date());
  const [
    series,
    exceptions,
    offPeriods,
    exams,
    tasks,
    assignments,
    events,
    studySession,
    habits,
    habitLogs,
  ] = await Promise.all([
    listCourseSeries(db),
    listCourseExceptions(db),
    listOffPeriods(db),
    listExams(db),
    listWorkItems(db, 'task'),
    listWorkItems(db, 'assignment'),
    listPersonalEvents(db),
    getActiveStudySession(db),
    listHabits(db),
    listHabitLogs(db, addDaysIso(today, -400), addDaysIso(today, 7)),
  ]);
  return {
    series,
    exceptions,
    offPeriods,
    exams,
    work: [...tasks, ...assignments],
    events,
    studySession,
    habits,
    habitLogs,
  };
}

/** Toutes les données du calendrier et d'« Aujourd'hui », rechargées à chaque modification. */
export function useAgendaData() {
  return useLiveQuery(loadAgenda, TABLES, []);
}
