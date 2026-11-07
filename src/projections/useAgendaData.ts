import { useCallback, useMemo } from 'react';

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
  listPersonalEventsSince,
  listRevisionBlocks,
  listSlots,
  listWorkItemsSince,
  slotOccurrences,
  type PersonalEvent,
} from '@/modules/productivity';
import { getActiveSpaces, getRotationAnchor, getWeekStart } from '@/modules/identity';
import { listRecurring, listTransactions } from '@/modules/finance';
import { addDaysIso, toIsoDate, type IsoDate } from '@/shared/dates';
import { settingTable, useSharedLiveQuery, type Db, type LiveResult } from '@/shared/db';
import type { ActiveSpaces } from '@/shared/spaces';

import { filterBySpaces } from './spaces';
import type { TodayData } from './today';

/**
 * Période lue par l'agenda : du 1er du mois d'il y a deux mois à la fin du mois dans un an,
 * élargie au mois près pour couvrir `range` (ex. le mois affiché par le calendrier). Les bornes
 * ne bougent qu'une fois par mois : la lecture partagée garde la même clé d'un jour à l'autre.
 */
export function agendaWindow(
  today: IsoDate,
  range?: { from: IsoDate; to: IsoDate },
): { from: IsoDate; to: IsoDate } {
  const monthStart = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  let from = monthStart(y, m - 2);
  // Veille du 1er du mois treize mois plus loin : fin du mois dans un an.
  let to = addDaysIso(monthStart(y, m + 13), -1);
  if (range && range.from < from) from = `${range.from.slice(0, 7)}-01`;
  if (range && range.to > to) {
    const ry = Number(range.to.slice(0, 4));
    const rm = Number(range.to.slice(5, 7)) - 1;
    to = addDaysIso(monthStart(ry, rm + 1), -1);
  }
  return { from, to };
}

/*
 * L'agenda est lu par morceaux, chacun relu seulement quand une de SES tables change :
 * enregistrer une dépense ne relit plus les tâches, les cours ni les habitudes.
 */

const coursesTables = ['course_series', 'course_exceptions', 'off_periods'] as const;
const examsTables = ['exams'] as const;
const workTables = ['tasks', 'assignments'] as const;
const eventsTables = ['personal_events'] as const;
// Seuls ces réglages changent les séances des créneaux : les autres ne relancent rien.
const slotsTables = [
  'work_slots',
  settingTable('week_start'),
  settingTable('rotation_anchor'),
] as const;
const studyTables = ['study_sessions'] as const;
const habitsTables = ['habits', 'habit_logs'] as const;
const revisionTables = ['revision_blocks'] as const;
const moodTables = ['mood_logs'] as const;
const moneyTables = ['money_recurring', 'money_transactions'] as const;
const spacesTables = [settingTable('spaces')] as const;

/** Toutes les tables lues par l'agenda (pour information et pour les tests). */
export const AGENDA_TABLES: readonly string[] = [
  ...coursesTables,
  ...examsTables,
  ...workTables,
  ...eventsTables,
  ...slotsTables,
  ...studyTables,
  ...habitsTables,
  ...revisionTables,
  ...moodTables,
  ...moneyTables,
  ...spacesTables,
];

const loadCourses = async (db: Db) => {
  const [series, exceptions, offPeriods] = await Promise.all([
    listCourseSeries(db),
    listCourseExceptions(db),
    listOffPeriods(db),
  ]);
  return { series, exceptions, offPeriods };
};

const loadWork = async (db: Db, from: IsoDate) => {
  const [tasks, assignments] = await Promise.all([
    listWorkItemsSince(db, 'task', from),
    listWorkItemsSince(db, 'assignment', from),
  ]);
  return [...tasks, ...assignments];
};

// Créneaux fixes du planning : séances calculées (jamais enregistrées), vues comme des
// rendez-vous partout (Aujourd'hui, planning, heures de la semaine).
const loadSlotEvents = async (db: Db, from: IsoDate, to: IsoDate) => {
  const [slots, anchor, weekStart] = await Promise.all([
    listSlots(db),
    getRotationAnchor(db),
    getWeekStart(db),
  ]);
  return slotOccurrences(slots, from, to, anchor, weekStart);
};

const loadHabits = async (db: Db) => {
  const today = toIsoDate(new Date());
  const [habits, habitLogs] = await Promise.all([
    listHabits(db),
    listHabitLogs(db, addDaysIso(today, -400), addDaysIso(today, 7)),
  ]);
  return { habits, habitLogs };
};

const loadMood = (db: Db) => {
  const today = toIsoDate(new Date());
  return listMoodLogs(db, addDaysIso(today, -90), today);
};

const loadMoney = async (db: Db) => {
  const today = toIsoDate(new Date());
  const [recurring, payments] = await Promise.all([
    listRecurring(db),
    listTransactions(db, { from: addDaysIso(today, -7), to: addDaysIso(today, 62) }),
  ]);
  return { recurring, payments: payments.filter((p) => p.recurringId !== null) };
};

type Parts = {
  courses: Awaited<ReturnType<typeof loadCourses>>;
  exams: TodayData['exams'];
  work: TodayData['work'];
  events: readonly PersonalEvent[];
  slotEvents: readonly PersonalEvent[];
  studySession: TodayData['studySession'];
  habits: Awaited<ReturnType<typeof loadHabits>>;
  revisionBlocks: TodayData['revisionBlocks'];
  moodLogs: TodayData['moodLogs'];
  money: NonNullable<TodayData['money']>;
};

function combine(p: Parts): TodayData {
  return {
    ...p.courses,
    exams: p.exams,
    work: p.work,
    events: [...p.events, ...p.slotEvents].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''),
    ),
    studySession: p.studySession,
    habits: p.habits.habits,
    habitLogs: p.habits.habitLogs,
    revisionBlocks: p.revisionBlocks,
    moodLogs: p.moodLogs,
    money: p.money,
  };
}

async function loadAllAgenda(db: Db): Promise<TodayData> {
  const w = agendaWindow(toIsoDate(new Date()));
  const [
    courses,
    exams,
    work,
    events,
    slotEvents,
    studySession,
    habits,
    revisionBlocks,
    moodLogs,
    money,
  ] = await Promise.all([
    loadCourses(db),
    listExams(db),
    loadWork(db, w.from),
    listPersonalEventsSince(db, w.from),
    loadSlotEvents(db, w.from, w.to),
    getActiveStudySession(db),
    loadHabits(db),
    listRevisionBlocks(db, { from: w.from }),
    loadMood(db),
    loadMoney(db),
  ]);
  return combine({
    courses,
    exams,
    work,
    events,
    slotEvents,
    studySession,
    habits,
    revisionBlocks,
    moodLogs,
    money,
  });
}

/** Données des espaces actifs seulement, en une lecture (tâche de fond des rappels). */
export async function loadAgenda(db: Db): Promise<TodayData> {
  const [data, spaces] = await Promise.all([loadAllAgenda(db), getActiveSpaces(db)]);
  return filterBySpaces(data, spaces);
}

const fg = { refreshOn: 'foreground' } as const;

/**
 * Données du calendrier et d'« Aujourd'hui », limitées aux espaces actifs. `allSpaces` : tout
 * (ex. créneaux déjà occupés du plan de révision). `range` : jours affichés, pour que la période
 * lue les couvre (calendrier loin dans le passé ou l'avenir).
 *
 * Chaque morceau est une lecture partagée par tous les écrans, relue seulement quand ses propres
 * tables changent, au retour de l'app (lecture de plus d'une minute) et au changement de jour.
 */
export function useAgendaData(
  options: { allSpaces?: boolean; range?: { from: IsoDate; to: IsoDate } } = {},
): LiveResult<TodayData> {
  const all = options.allSpaces === true;
  const today = toIsoDate(new Date());
  const { from, to } = agendaWindow(today, options.range);

  const courses = useSharedLiveQuery('agenda:courses', loadCourses, coursesTables, fg);
  const exams = useSharedLiveQuery('agenda:exams', listExams, examsTables, fg);
  const work = useSharedLiveQuery(
    `agenda:work:${from}`,
    (db) => loadWork(db, from),
    workTables,
    fg,
  );
  const events = useSharedLiveQuery(
    `agenda:events:${from}`,
    (db) => listPersonalEventsSince(db, from),
    eventsTables,
    fg,
  );
  const slotEvents = useSharedLiveQuery(
    `agenda:slots:${from}:${to}`,
    (db) => loadSlotEvents(db, from, to),
    slotsTables,
    fg,
  );
  const study = useSharedLiveQuery('agenda:study', getActiveStudySession, studyTables, fg);
  const habits = useSharedLiveQuery('agenda:habits', loadHabits, habitsTables, fg);
  const revision = useSharedLiveQuery(
    `agenda:revision:${from}`,
    (db) => listRevisionBlocks(db, { from }),
    revisionTables,
    fg,
  );
  const mood = useSharedLiveQuery('agenda:mood', loadMood, moodTables, fg);
  const money = useSharedLiveQuery('agenda:money', loadMoney, moneyTables, fg);
  const spaces = useSharedLiveQuery<ActiveSpaces>(
    'agenda:spaces',
    getActiveSpaces,
    spacesTables,
    fg,
  );

  const data = useMemo(() => {
    if (
      courses.data === undefined ||
      exams.data === undefined ||
      work.data === undefined ||
      events.data === undefined ||
      slotEvents.data === undefined ||
      study.data === undefined ||
      habits.data === undefined ||
      revision.data === undefined ||
      mood.data === undefined ||
      money.data === undefined ||
      spaces.data === undefined
    )
      return undefined;
    const combined = combine({
      courses: courses.data,
      exams: exams.data,
      work: work.data,
      events: events.data,
      slotEvents: slotEvents.data,
      studySession: study.data,
      habits: habits.data,
      revisionBlocks: revision.data,
      moodLogs: mood.data,
      money: money.data,
    });
    return all ? combined : filterBySpaces(combined, spaces.data);
  }, [
    all,
    courses.data,
    exams.data,
    work.data,
    events.data,
    slotEvents.data,
    study.data,
    habits.data,
    revision.data,
    mood.data,
    money.data,
    spaces.data,
  ]);

  const parts = useMemo(
    () => [courses, exams, work, events, slotEvents, study, habits, revision, mood, money, spaces],
    [courses, exams, work, events, slotEvents, study, habits, revision, mood, money, spaces],
  );
  const loading = parts.some((p) => p.loading);
  const error = parts.find((p) => p.error)?.error ?? null;
  // « Réessayer » relance les morceaux en échec (tous si aucun n'a échoué).
  const retry = useCallback(() => {
    const failed = parts.filter((p) => p.error);
    (failed.length > 0 ? failed : parts).forEach((p) => p.retry());
  }, [parts]);

  return useMemo(() => ({ data, loading, error, retry }), [data, loading, error, retry]);
}
