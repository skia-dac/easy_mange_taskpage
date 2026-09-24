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
  listMoodLogs,
  listRevisionBlocks,
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
  'revision_blocks',
  'mood_logs',
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
    revisionBlocks,
    moodLogs,
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
    listRevisionBlocks(db, { from: addDaysIso(today, -60) }),
    listMoodLogs(db, addDaysIso(today, -90), today),
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
    revisionBlocks,
    moodLogs,
  };
}

/** Toutes les données du calendrier et d'« Aujourd'hui », rechargées à chaque modification. */
export function useAgendaData() {
  return useLiveQuery(loadAgenda, TABLES, []);
}
