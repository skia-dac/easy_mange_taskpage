import {
  listCourseExceptions,
  listCourseSeries,
  listExams,
  listOffPeriods,
} from '@/modules/academic';
import { listPersonalEvents, listWorkItems } from '@/modules/productivity';
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
] as const;

async function loadAgenda(db: Db): Promise<TodayData> {
  const [series, exceptions, offPeriods, exams, tasks, assignments, events] = await Promise.all([
    listCourseSeries(db),
    listCourseExceptions(db),
    listOffPeriods(db),
    listExams(db),
    listWorkItems(db, 'task'),
    listWorkItems(db, 'assignment'),
    listPersonalEvents(db),
  ]);
  return { series, exceptions, offPeriods, exams, work: [...tasks, ...assignments], events };
}

/** Toutes les données du calendrier et d'« Aujourd'hui », rechargées à chaque modification. */
export function useAgendaData() {
  return useLiveQuery(loadAgenda, TABLES, []);
}
