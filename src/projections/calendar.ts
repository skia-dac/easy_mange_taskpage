import { occurrencesInRange, type Exam, type Occurrence } from '@/modules/academic';
import type { PersonalEvent, WorkItem } from '@/modules/productivity';
import { addDaysIso, type IsoDate } from '@/shared/dates';

import type { TodayData } from './today';

export type CalendarItem =
  | { kind: 'course'; sortTime: string; occurrence: Occurrence }
  | { kind: 'exam'; sortTime: string; exam: Exam }
  | { kind: 'work'; sortTime: string; item: WorkItem }
  | { kind: 'event'; sortTime: string; event: PersonalEvent };

/**
 * Le calendrier rassemble cours, examens, tâches, devoirs et événements (§37) sans les copier.
 * Retourne une entrée par jour de la période (même vide), éléments triés par heure.
 */
export function calendarDays(
  data: TodayData,
  from: IsoDate,
  to: IsoDate,
): Map<IsoDate, CalendarItem[]> {
  const days = new Map<IsoDate, CalendarItem[]>();
  for (let d = from; d <= to; d = addDaysIso(d, 1)) days.set(d, []);
  const push = (day: IsoDate, item: CalendarItem) => days.get(day)?.push(item);

  for (const o of occurrencesInRange(data.series, from, to)) {
    push(o.date, { kind: 'course', sortTime: o.startTime, occurrence: o });
  }
  for (const e of data.exams) push(e.date, { kind: 'exam', sortTime: e.time ?? '00:00', exam: e });
  for (const w of data.work)
    push(w.dueDate, { kind: 'work', sortTime: w.dueTime ?? '23:59', item: w });
  for (const e of data.events) {
    push(e.date, { kind: 'event', sortTime: e.startTime ?? '00:00', event: e });
  }
  for (const items of days.values()) items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  return days;
}
