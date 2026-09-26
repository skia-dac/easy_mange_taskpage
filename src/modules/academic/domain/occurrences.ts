import { addDaysIso, isoWeekday, type IsoDate } from '@/shared/dates';

import type { CourseSeries, Occurrence } from './course';
import type { CourseException } from './exception';
import { isDayOff, type OffPeriod } from './offPeriod';

export type OccurrenceContext = {
  exceptions?: readonly CourseException[];
  offPeriods?: readonly OffPeriod[];
};

/** La série prévoit-elle une séance ce jour-là ? */
function seriesHasDay(s: CourseSeries, day: IsoDate): boolean {
  if (day < s.validFrom || day > s.validUntil || isoWeekday(day) !== s.weekday) return false;
  if (s.recurrence !== 'none') return true;
  // Cours unique : seulement la première date possible.
  return day === addDaysIso(s.validFrom, (s.weekday - isoWeekday(s.validFrom) + 7) % 7);
}

function buildOccurrence(
  s: CourseSeries,
  originalDate: IsoDate,
  ex: CourseException | undefined,
): Occurrence {
  return {
    seriesId: s.id,
    subjectId: s.subjectId,
    date: ex?.kind === 'modified' && ex.newDate ? ex.newDate : originalDate,
    originalDate,
    startTime: ex?.newStartTime ?? s.startTime,
    endTime: ex?.newEndTime ?? s.endTime,
    title: ex?.newTitle ?? s.title,
    teacher: ex?.newTeacher ?? s.teacher,
    room: ex?.newRoom ?? s.room,
    courseType: s.courseType,
    recurrence: s.recurrence,
    status: ex?.kind === 'cancelled' ? 'cancelled' : ex ? 'modified' : 'normal',
    exceptionId: ex?.id ?? null,
    note: ex?.note ?? null,
  };
}

/**
 * Toutes les séances des cours entre `from` et `to` (inclus), triées par date puis heure.
 * Les séances ne sont pas stockées : elles sont calculées à partir des séries (architecture §6),
 * puis ajustées :
 * - exception « modified » : heures / salle / prof. remplacés pour ce jour, voire jour déplacé ;
 * - exception « cancelled » : la séance reste, marquée annulée (§29) ;
 * - vacances avec suspension : la séance est masquée (§42), sans rien supprimer.
 */
export function occurrencesInRange(
  series: readonly CourseSeries[],
  from: IsoDate,
  to: IsoDate,
  context: OccurrenceContext = {},
): Occurrence[] {
  const byKey = new Map<string, CourseException>();
  const moved: CourseException[] = [];
  for (const e of context.exceptions ?? []) {
    byKey.set(`${e.seriesId}|${e.date}`, e);
    if (e.kind === 'modified' && e.newDate && e.newDate !== e.date) moved.push(e);
  }
  const suspending = (context.offPeriods ?? []).filter((p) => p.suspendCourses);
  const isMoved = (ex: CourseException | undefined) =>
    ex?.kind === 'modified' && !!ex.newDate && ex.newDate !== ex.date;

  const result: Occurrence[] = [];
  for (const s of series) {
    const start = s.validFrom > from ? s.validFrom : from;
    const end = s.validUntil < to ? s.validUntil : to;
    if (start > end) continue;
    // Premier jour ≥ start qui tombe le bon jour de la semaine.
    let day = addDaysIso(start, (s.weekday - isoWeekday(start) + 7) % 7);
    while (day <= end) {
      const ex = byKey.get(`${s.id}|${day}`);
      // Une séance déplacée est ajoutée plus bas, à son nouveau jour.
      if (!isMoved(ex) && !isDayOff(suspending, day) && seriesHasDay(s, day)) {
        result.push(buildOccurrence(s, day, ex));
      }
      if (s.recurrence === 'none') break;
      day = addDaysIso(day, 7);
    }
  }

  const seriesById = new Map(series.map((s) => [s.id, s]));
  for (const ex of moved) {
    const s = seriesById.get(ex.seriesId);
    const target = ex.newDate as IsoDate;
    if (!s || target < from || target > to || !seriesHasDay(s, ex.date)) continue;
    if (isDayOff(suspending, target)) continue;
    result.push(buildOccurrence(s, ex.date, ex));
  }

  return result.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/** Séances d'une période concernées par une suspension (pour prévenir avant d'enregistrer, §42). */
export function countAffectedOccurrences(
  series: readonly CourseSeries[],
  from: IsoDate,
  to: IsoDate,
  context: OccurrenceContext = {},
): number {
  // Une séance déjà annulée ou déjà masquée par une autre suspension ne compte pas.
  return occurrencesInRange(series, from, to, context).filter((o) => o.status !== 'cancelled')
    .length;
}
