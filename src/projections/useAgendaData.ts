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
  listSlots,
  listWorkItems,
  slotOccurrences,
} from '@/modules/productivity';
import { getActiveSpaces, getRotationAnchor, getWeekStart } from '@/modules/identity';
import { listRecurring, listTransactions } from '@/modules/finance';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { settingTable, useSharedLiveQuery, type Db } from '@/shared/db';

import { filterBySpaces } from './spaces';
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
  'money_recurring',
  'money_transactions',
  'work_slots',
  // Seuls ces réglages changent l'agenda : les autres (apparence, rappels…) ne le relancent pas.
  settingTable('spaces'),
  settingTable('week_start'),
  settingTable('rotation_anchor'),
] as const;

/** Toutes les données (tous espaces confondus). */
async function loadAllAgenda(db: Db): Promise<TodayData> {
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
    recurring,
    payments,
    slots,
    anchor,
    weekStart,
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
    listRecurring(db),
    listTransactions(db, { from: addDaysIso(today, -7), to: addDaysIso(today, 62) }),
    listSlots(db),
    getRotationAnchor(db),
    getWeekStart(db),
  ]);
  // Créneaux fixes du planning : séances calculées (jamais enregistrées), vues comme des
  // rendez-vous partout (Aujourd'hui, planning, heures de la semaine).
  const slotEvents = slotOccurrences(
    slots,
    addDaysIso(today, -120),
    addDaysIso(today, 365),
    anchor,
    weekStart,
  );
  return {
    series,
    exceptions,
    offPeriods,
    exams,
    work: [...tasks, ...assignments],
    events: [...events, ...slotEvents].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    ),
    studySession,
    habits,
    habitLogs,
    revisionBlocks,
    moodLogs,
    money: { recurring, payments: payments.filter((p) => p.recurringId !== null) },
  };
}

/** Données des espaces actifs seulement (ce que l'étudiant ou le salarié voit). */
export async function loadAgenda(db: Db): Promise<TodayData> {
  const [data, spaces] = await Promise.all([loadAllAgenda(db), getActiveSpaces(db)]);
  return filterBySpaces(data, spaces);
}

/**
 * Toutes les données du calendrier et d'« Aujourd'hui », rechargées à chaque modification,
 * limitées aux espaces actifs. `allSpaces` : tout (ex. créneaux déjà occupés du plan de révision).
 * Une seule lecture partagée par tous les écrans qui l'affichent en même temps ; rechargée au
 * retour de l'app (lecture de plus d'une minute) et au changement de jour.
 */
export function useAgendaData(options: { allSpaces?: boolean } = {}) {
  const all = options.allSpaces === true;
  return useSharedLiveQuery(
    all ? 'agenda:all' : 'agenda',
    all ? loadAllAgenda : loadAgenda,
    TABLES,
    { refreshOn: 'foreground' },
  );
}
