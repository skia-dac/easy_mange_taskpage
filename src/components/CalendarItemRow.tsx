import type { Subject } from '@/modules/academic';
import type { CalendarItem } from '@/projections';

import { DayOffRow } from './DayOffRow';
import { CourseRow, EventRow, ExamRow, RevisionRow, WorkRow } from './AgendaRows';

type Props = { item: CalendarItem; subjects: ReadonlyMap<string, Subject>; now: Date };

export function CalendarItemRow({ item, subjects, now }: Props) {
  switch (item.kind) {
    case 'course':
      return <CourseRow occurrence={item.occurrence} subjects={subjects} />;
    case 'exam':
      return <ExamRow exam={item.exam} subjects={subjects} now={now} />;
    case 'work':
      return <WorkRow item={item.item} subjects={subjects} now={now} />;
    case 'event':
      return <EventRow event={item.event} />;
    case 'dayOff':
      return <DayOffRow period={item.period} />;
    case 'revision':
      return <RevisionRow block={item.block} subjects={subjects} />;
  }
}

export function calendarItemKey(item: CalendarItem): string {
  switch (item.kind) {
    case 'course':
      // Une séance déplacée peut tomber le même jour qu'une séance régulière : le jour d'origine
      // distingue les deux.
      return `c-${item.occurrence.seriesId}-${item.occurrence.originalDate}`;
    case 'exam':
      return `x-${item.exam.id}`;
    case 'work':
      return `w-${item.item.kind}-${item.item.id}`;
    case 'event':
      return `e-${item.event.id}`;
    case 'dayOff':
      return `o-${item.period.id}`;
    case 'revision':
      return `r-${item.block.id}`;
  }
}
