import { slotOccurrences, type Slot } from '@/modules/productivity';

import { workWeek } from './glance';
import type { TodayData } from './today';

const nights: Slot = {
  id: 'n',
  title: 'Garde',
  weekdays: [1],
  startTime: '22:00',
  endTime: '06:00',
  location: null,
  note: null,
  rotation: 'every',
  validFrom: '2026-09-01',
  validUntil: null,
  colorId: 'blue',
  space: 'work',
};

const data = (events: TodayData['events']): TodayData => ({
  series: [],
  exams: [],
  work: [],
  events,
});

describe('heures Pro de la semaine', () => {
  it('un créneau de nuit compte sa durée entière, une seule fois (#11a)', () => {
    // Lundi 21 : 22:00 → mardi 06:00 = 480 min, réparties sur deux événements.
    const events = slotOccurrences([nights], '2026-09-21', '2026-09-27', '2026-09-21', 1);
    expect(events).toHaveLength(2);
    expect(workWeek(data(events), '2026-09-21', 10)).toEqual({
      plannedMinutes: 480,
      targetMinutes: 600,
      toPlanMinutes: 120,
    });
  });

  it('rendez-vous Pro : durée, ou 1 h sans heure de fin', () => {
    const events: TodayData['events'] = [
      {
        id: 'e1',
        title: 'Réunion',
        date: '2026-09-22',
        startTime: '09:00',
        endTime: '10:30',
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'e2',
        title: 'Appel',
        date: '2026-09-23',
        startTime: '14:00',
        endTime: null,
        description: null,
        reminderAt: null,
        space: 'work',
      },
      {
        id: 'e3',
        title: 'Ciné',
        date: '2026-09-23',
        startTime: '20:00',
        endTime: '22:00',
        description: null,
        reminderAt: null,
        space: 'personal',
      },
    ];
    expect(workWeek(data(events), '2026-09-21', 2).plannedMinutes).toBe(150);
  });
});
