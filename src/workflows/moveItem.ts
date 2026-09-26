import { getCourseException, overrideOccurrence } from '@/modules/academic';
import {
  getPersonalEvent,
  moveRevisionBlock,
  rescheduleWorkItem,
  updatePersonalEvent,
} from '@/modules/productivity';
import type { CalendarItem, MoveTarget } from '@/projections';
import { atTime } from '@/shared/dates';
import type { Db } from '@/shared/db';

/**
 * Déplacement par glisser-déposer dans la vue heures :
 * - cours : seule cette séance change (exception « modifiée », jour et heures) ;
 * - tâche / devoir : nouvelle échéance (l'heure limite = la fin du bloc), le rappel suit ;
 * - révision, événement : nouveau jour et nouvelles heures, le rappel de l'événement suit.
 */
export async function moveCalendarItem(db: Db, item: CalendarItem, to: MoveTarget): Promise<void> {
  switch (item.kind) {
    case 'course': {
      const o = item.occurrence;
      const current = await getCourseException(db, o.seriesId, o.originalDate);
      const kept = current?.kind === 'modified' ? current : null;
      await overrideOccurrence(db, {
        seriesId: o.seriesId,
        date: o.originalDate,
        newDate: to.date,
        newStartTime: to.startTime,
        newEndTime: to.endTime,
        newRoom: kept?.newRoom ?? null,
        newTeacher: kept?.newTeacher ?? null,
        newTitle: kept?.newTitle ?? null,
        note: kept?.note ?? null,
      });
      return;
    }
    case 'work':
      await rescheduleWorkItem(db, item.item.kind, item.item.id, to.date, to.endTime);
      return;
    case 'revision':
      await moveRevisionBlock(db, item.block.id, to);
      return;
    case 'event': {
      const e = await getPersonalEvent(db, item.event.id);
      if (!e) return;
      const shift =
        atTime(to.date, to.startTime).getTime() -
        atTime(e.date, e.startTime ?? to.startTime).getTime();
      await updatePersonalEvent(db, e.id, {
        ...e,
        date: to.date,
        startTime: to.startTime,
        endTime: e.endTime ? to.endTime : null,
        reminderAt: e.reminderAt
          ? new Date(new Date(e.reminderAt).getTime() + shift).toISOString()
          : null,
      });
      return;
    }
    default:
      return;
  }
}
