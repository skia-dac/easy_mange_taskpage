import { addDaysIso, isoWeekday, type IsoDate } from '@/shared/dates';

import type { CourseSeries, Occurrence } from './course';

/**
 * Toutes les séances des cours entre `from` et `to` (inclus), triées par date puis heure.
 * Les séances ne sont pas stockées : elles sont calculées à partir des séries (architecture §6).
 */
export function occurrencesInRange(
  series: readonly CourseSeries[],
  from: IsoDate,
  to: IsoDate,
): Occurrence[] {
  const result: Occurrence[] = [];
  for (const s of series) {
    const start = s.validFrom > from ? s.validFrom : from;
    const end = s.validUntil < to ? s.validUntil : to;
    if (start > end) continue;
    // Premier jour ≥ start qui tombe le bon jour de la semaine.
    let day = addDaysIso(start, (s.weekday - isoWeekday(start) + 7) % 7);
    while (day <= end) {
      result.push({
        seriesId: s.id,
        subjectId: s.subjectId,
        date: day,
        startTime: s.startTime,
        endTime: s.endTime,
        title: s.title,
        teacher: s.teacher,
        room: s.room,
        courseType: s.courseType,
        recurrence: s.recurrence,
      });
      if (s.recurrence === 'none') break;
      day = addDaysIso(day, 7);
    }
  }
  return result.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}
