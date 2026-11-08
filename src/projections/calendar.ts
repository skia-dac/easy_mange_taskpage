import { occurrencesInRange, type Exam, type Occurrence, type OffPeriod } from '@/modules/academic';
import type { PersonalEvent, RevisionBlock, WorkItem } from '@/modules/productivity';
import { addDaysIso, type IsoDate } from '@/shared/dates';

import type { TodayData } from './today';

export type CalendarViewMode = 'day' | 'week' | 'hours' | 'month';

/**
 * Jour choisi après une flèche ‹ › du calendrier : un jour en vue Jour, une semaine en vue
 * Semaine ou Heures, un mois en vue Mois (au 1er du mois, pour ne pas sauter février).
 */
export function calendarStep(mode: CalendarViewMode, selected: IsoDate, dir: 1 | -1): IsoDate {
  if (mode === 'day') return addDaysIso(selected, dir);
  if (mode === 'month') {
    const d = new Date(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)) - 1 + dir, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return addDaysIso(selected, dir * 7);
}

export type CalendarItem =
  | { kind: 'course'; sortTime: string; occurrence: Occurrence }
  | { kind: 'exam'; sortTime: string; exam: Exam }
  | { kind: 'work'; sortTime: string; item: WorkItem }
  | { kind: 'event'; sortTime: string; event: PersonalEvent }
  | { kind: 'revision'; sortTime: string; block: RevisionBlock }
  | { kind: 'dayOff'; sortTime: string; period: OffPeriod };

/**
 * Le calendrier rassemble cours, examens, tâches, devoirs, événements (§37) et séances de révision
 * sans les copier.
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

  for (const p of data.offPeriods ?? []) {
    for (
      let d = p.startDate > from ? p.startDate : from;
      d <= (p.endDate < to ? p.endDate : to);
      d = addDaysIso(d, 1)
    ) {
      push(d, { kind: 'dayOff', sortTime: '', period: p });
    }
  }
  for (const o of occurrencesInRange(data.series, from, to, data)) {
    push(o.date, { kind: 'course', sortTime: o.startTime, occurrence: o });
  }
  for (const e of data.exams) push(e.date, { kind: 'exam', sortTime: e.time ?? '00:00', exam: e });
  for (const w of data.work)
    if (w.dueDate) push(w.dueDate, { kind: 'work', sortTime: w.dueTime ?? '23:59', item: w });
  for (const e of data.events) {
    push(e.date, { kind: 'event', sortTime: e.startTime ?? '00:00', event: e });
  }
  for (const b of data.revisionBlocks ?? []) {
    push(b.date, { kind: 'revision', sortTime: b.startTime, block: b });
  }
  for (const items of days.values()) items.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  return days;
}
