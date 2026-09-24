import type { Occurrence } from '@/modules/academic';
import type { PersonalEvent, WorkItem } from '@/modules/productivity';

import type { CalendarItem } from './calendar';
import { filterItems, layoutDay, moveTarget, visibleHours } from './hourGrid';

const course = (start: string, end: string, id = start): CalendarItem => ({
  kind: 'course',
  sortTime: start,
  occurrence: {
    seriesId: id,
    subjectId: 's',
    date: '2026-09-23',
    originalDate: '2026-09-23',
    startTime: start,
    endTime: end,
    status: 'normal',
  } as Occurrence,
});
const work = (dueTime: string | null, estimatedMinutes: number | null = null): CalendarItem => ({
  kind: 'work',
  sortTime: dueTime ?? '23:59',
  item: { id: 'w', kind: 'task', dueTime, estimatedMinutes, status: 'todo' } as WorkItem,
});
const event: CalendarItem = {
  kind: 'event',
  sortTime: '00:00',
  event: { id: 'e', startTime: null } as PersonalEvent,
};

describe('vue heures', () => {
  it('met côte à côte ce qui se chevauche, le reste sur toute la largeur', () => {
    const { timed, untimed } = layoutDay([
      course('08:00', '10:00', 'a'),
      course('09:00', '11:00', 'b'),
      course('10:00', '12:00', 'c'),
      course('14:00', '15:00', 'd'),
      work(null),
      event,
    ]);
    expect(timed.map((b) => [b.start / 60, b.lane, b.lanes])).toEqual([
      [8, 0, 2],
      [9, 1, 2],
      [10, 0, 2],
      [14, 0, 1],
    ]);
    expect(untimed).toHaveLength(2);
  });

  it('une tâche occupe sa durée estimée avant son heure limite', () => {
    const { timed } = layoutDay([work('18:00', 90), work('10:00')]);
    expect(timed.map((b) => [b.start, b.end])).toEqual([
      [570, 600],
      [990, 1080],
    ]);
  });

  it('élargit les heures affichées si besoin', () => {
    expect(visibleHours(layoutDay([course('06:30', '07:30')]).timed)).toEqual({ from: 6, to: 22 });
    expect(visibleHours([])).toEqual({ from: 7, to: 22 });
  });

  it('déplace au quart d’heure, même durée, sans sortir de la journée', () => {
    expect(moveTarget({ start: 480, end: 600 }, '2026-09-23', 2, 37)).toEqual({
      date: '2026-09-25',
      startTime: '08:30',
      endTime: '10:30',
    });
    expect(moveTarget({ start: 1320, end: 1410 }, '2026-09-23', -1, 120)).toEqual({
      date: '2026-09-22',
      startTime: '22:30',
      endTime: '23:59',
    });
  });

  it('filtre par type sans cacher les vacances', () => {
    const items = [course('08:00', '09:00'), work('10:00')];
    expect(filterItems(items, new Set(['work'])).map((i) => i.kind)).toEqual(['work']);
  });
});
