import { occurrencesInRange } from '@/modules/academic';
import { studyTotals, type StudySession } from '@/modules/productivity';
import { addDaysIso, daysBetween, timeToMinutes, toIsoDate, type IsoDate } from '@/shared/dates';

import type { TodayData } from './today';

export type WeekStats = {
  from: IsoDate;
  to: IsoDate;
  /** Minutes de cours (séances non annulées) sur la semaine. */
  courseMinutes: number;
  /** Tâches et devoirs terminés cette semaine. */
  tasksDone: number;
  /** Tâches et devoirs encore ouverts dont l'échéance est dans la semaine. */
  tasksOpen: number;
  studyMinutes: number;
  /** Minutes de révision par jour de la semaine (7 entrées, dans l'ordre). */
  studyByDay: { day: IsoDate; minutes: number }[];
  /** Jours consécutifs (jusqu'à aujourd'hui ou hier) avec une tâche terminée ou une révision. */
  streakDays: number;
};

/** Jour (ISO) d'un instant ISO, dans le fuseau du téléphone. */
function dayOf(iso: string): IsoDate {
  return toIsoDate(new Date(iso));
}

/**
 * Statistiques de la semaine : calculées à partir des données (jamais stockées).
 * `sessions` : toutes les sessions utiles (semaine + jours précédents pour la série).
 */
export function weekStats(
  data: TodayData,
  sessions: readonly StudySession[],
  from: IsoDate,
  now: Date,
): WeekStats {
  const to = addDaysIso(from, 6);
  const today = toIsoDate(now);

  let courseMinutes = 0;
  for (const o of occurrencesInRange(data.series, from, to, data)) {
    if (o.status === 'cancelled') continue;
    courseMinutes += Math.max(0, timeToMinutes(o.endTime) - timeToMinutes(o.startTime));
  }

  const doneDays = new Set<IsoDate>();
  let tasksDone = 0;
  let tasksOpen = 0;
  for (const w of data.work) {
    if (w.status === 'done' && w.completedAt) {
      const d = dayOf(w.completedAt);
      doneDays.add(d);
      if (d >= from && d <= to) tasksDone++;
    } else if (w.status !== 'done' && w.dueDate >= from && w.dueDate <= to) tasksOpen++;
  }

  const totals = studyTotals(sessions, from, to, now);
  const studyByDay = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysIso(from, i);
    return { day, minutes: Math.round(totals.byDay.get(day) ?? 0) };
  });

  const activeDays = new Set<IsoDate>(doneDays);
  for (const s of sessions) {
    if (s.kind === 'focus' && (s.endedAt !== null || s.startedAt <= now.toISOString()))
      activeDays.add(dayOf(s.startedAt));
  }
  let streakDays = 0;
  let cursor = activeDays.has(today) ? today : addDaysIso(today, -1);
  while (activeDays.has(cursor) && daysBetween(cursor, today) < 400) {
    streakDays++;
    cursor = addDaysIso(cursor, -1);
  }

  return {
    from,
    to,
    courseMinutes,
    tasksDone,
    tasksOpen,
    studyMinutes: Math.round(totals.totalMinutes),
    studyByDay,
    streakDays,
  };
}
