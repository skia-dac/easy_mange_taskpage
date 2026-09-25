import { workSpace, blockMinutes } from '@/modules/productivity';
import { addDaysIso, timeToMinutes, toIsoDate, type IsoDate } from '@/shared/dates';
import type { ActiveSpaces } from '@/shared/spaces';

import type { TodayData, TodayView } from './today';

/** Les tuiles possibles en haut d'Aujourd'hui. */
export type GlanceTileId =
  | 'money'
  | 'habits'
  | 'todo'
  | 'exam'
  | 'plan'
  | 'courses'
  | 'revision'
  | 'meetings'
  | 'doneWeek'
  | 'due';

/**
 * Les 4 tuiles selon les espaces actifs (maquettes validées) :
 * Études seul · Pro seul · Perso seul · deux espaces · les trois.
 */
export function glanceTiles(active: ActiveSpaces): GlanceTileId[] {
  const study = active.includes('study');
  const work = active.includes('work');
  const personal = active.includes('personal');
  if (study && !work && !personal) return ['courses', 'exam', 'todo', 'revision'];
  if (work && !study && !personal) return ['todo', 'plan', 'meetings', 'doneWeek'];
  if (personal && !study && !work) return ['money', 'habits', 'todo', 'due'];
  if (study && work && !personal) return ['todo', 'exam', 'plan', 'courses'];
  if (work && personal && !study) return ['money', 'habits', 'todo', 'plan'];
  return ['money', 'habits', 'todo', 'exam'];
}

/** Durée retenue pour un rendez-vous sans heure de fin (planning de la semaine). */
export const DEFAULT_EVENT_MINUTES = 60;

const inWeek = (day: IsoDate, weekFrom: IsoDate) =>
  day >= weekFrom && day <= addDaysIso(weekFrom, 6);

export type WorkWeek = { plannedMinutes: number; targetMinutes: number; toPlanMinutes: number };

/**
 * Heures « Pro » de la semaine : rendez-vous Pro (durée, ou 1 h sans heure de fin) et durées
 * estimées des tâches Pro de la semaine. « À planifier » = objectif − déjà planifié.
 */
export function workWeek(data: TodayData, weekFrom: IsoDate, targetHours: number): WorkWeek {
  let planned = 0;
  for (const e of data.events) {
    if (e.space !== 'work' || !inWeek(e.date, weekFrom) || !e.startTime) continue;
    planned += e.endTime
      ? Math.max(0, timeToMinutes(e.endTime) - timeToMinutes(e.startTime))
      : DEFAULT_EVENT_MINUTES;
  }
  for (const w of data.work) {
    if (workSpace(w) !== 'work' || !inWeek(w.dueDate, weekFrom)) continue;
    planned += w.estimatedMinutes ?? 0;
  }
  const target = Math.round(targetHours * 60);
  return {
    plannedMinutes: planned,
    targetMinutes: target,
    toPlanMinutes: Math.max(0, target - planned),
  };
}

/** Rendez-vous Pro du jour (avec une heure) et leur durée totale. */
export function meetingsToday(view: Pick<TodayView, 'events'>): { count: number; minutes: number } {
  const list = view.events.filter((e) => e.space === 'work' && e.startTime);
  const minutes = list.reduce(
    (sum, e) =>
      sum +
      (e.endTime && e.startTime
        ? Math.max(0, timeToMinutes(e.endTime) - timeToMinutes(e.startTime))
        : DEFAULT_EVENT_MINUTES),
    0,
  );
  return { count: list.length, minutes };
}

/** Tâches Pro terminées cette semaine. */
export function doneThisWeek(data: TodayData, weekFrom: IsoDate): number {
  return data.work.filter(
    (w) =>
      workSpace(w) === 'work' &&
      w.status === 'done' &&
      w.completedAt !== null &&
      inWeek(toIsoDate(new Date(w.completedAt)), weekFrom),
  ).length;
}

/** Cours du jour (non annulés) : nombre, durée totale et heure de fin du dernier. */
export function coursesToday(view: Pick<TodayView, 'courses'>): {
  count: number;
  minutes: number;
  endsAt: string | null;
} {
  const list = view.courses.filter((o) => o.status !== 'cancelled');
  return {
    count: list.length,
    minutes: list.reduce(
      (s, o) => s + Math.max(0, timeToMinutes(o.endTime) - timeToMinutes(o.startTime)),
      0,
    ),
    endsAt: list.reduce<string | null>((m, o) => (!m || o.endTime > m ? o.endTime : m), null),
  };
}

/** Révisions de la semaine : faites / prévues (minutes). Les séances sautées ne comptent pas. */
export function revisionWeek(
  data: TodayData,
  weekFrom: IsoDate,
): { doneMinutes: number; plannedMinutes: number } {
  let done = 0;
  let planned = 0;
  for (const b of data.revisionBlocks ?? []) {
    if (!inWeek(b.date, weekFrom) || b.status === 'skipped') continue;
    planned += blockMinutes(b);
    if (b.status === 'done') done += blockMinutes(b);
  }
  return { doneMinutes: done, plannedMinutes: planned };
}
