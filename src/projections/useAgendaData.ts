import { listCourseSeries, listExams } from '@/modules/academic';
import { listPersonalEvents, listWorkItems } from '@/modules/productivity';
import { useLiveQuery, type Db } from '@/shared/db';

import type { TodayData } from './today';

const TABLES = ['course_series', 'exams', 'tasks', 'assignments', 'personal_events'] as const;

async function loadAgenda(db: Db): Promise<TodayData> {
  const [series, exams, tasks, assignments, events] = await Promise.all([
    listCourseSeries(db),
    listExams(db),
    listWorkItems(db, 'task'),
    listWorkItems(db, 'assignment'),
    listPersonalEvents(db),
  ]);
  return { series, exams, work: [...tasks, ...assignments], events };
}

/** Toutes les données du calendrier et d'« Aujourd'hui », rechargées à chaque modification. */
export function useAgendaData() {
  return useLiveQuery(loadAgenda, TABLES, []);
}
