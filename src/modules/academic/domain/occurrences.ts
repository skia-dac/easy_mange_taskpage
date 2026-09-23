import { addDaysIso, isoWeekday, type IsoDate } from '@/shared/dates';

import type { CourseSeries, Occurrence } from './course';
import type { CourseException } from './exception';
import { isDayOff, type OffPeriod } from './offPeriod';

export type OccurrenceContext = {
  exceptions?: readonly CourseException[];
  offPeriods?: readonly OffPeriod[];
};

/**
 * Toutes les séances des cours entre `from` et `to` (inclus), triées par date puis heure.
 * Les séances ne sont pas stockées : elles sont calculées à partir des séries (architecture §6),
 * puis ajustées :
 * - exception « modified » : heures / salle / prof. remplacés pour ce jour ;
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
  for (const e of context.exceptions ?? []) byKey.set(`${e.seriesId}|${e.date}`, e);
  const suspending = (context.offPeriods ?? []).filter((p) => p.suspendCourses);

  const result: Occurrence[] = [];
  for (const s of series) {
    const start = s.validFrom > from ? s.validFrom : from;
    const end = s.validUntil < to ? s.validUntil : to;
    if (start > end) continue;
    // Premier jour ≥ start qui tombe le bon jour de la semaine.
    let day = addDaysIso(start, (s.weekday - isoWeekday(start) + 7) % 7);
    while (day <= end) {
      const off = isDayOff(suspending, day);
      const ex = byKey.get(`${s.id}|${day}`);
      if (!off) {
        result.push({
          seriesId: s.id,
          subjectId: s.subjectId,
          date: day,
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
        });
      }
      if (s.recurrence === 'none') break;
      day = addDaysIso(day, 7);
    }
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
): number {
  return occurrencesInRange(series, from, to).length;
}
