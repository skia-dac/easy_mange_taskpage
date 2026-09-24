import type { Habit, HabitLog, MoodLog } from '@/modules/productivity';

import { moodInsights } from './mood';

const sport: Habit = {
  id: 'h',
  position: 0,
  name: 'Sport',
  icon: 'activity',
  colorId: 'green',
  frequency: 'daily',
  weekdays: [],
  timesPerWeek: 1,
  target: 1,
  unit: null,
  reminderTime: null,
  autoStudy: false,
};
const mood = (date: string, m: number, e: number): MoodLog => ({
  id: date,
  date,
  mood: m,
  energy: e,
  note: null,
});
const done = (date: string): HabitLog => ({
  id: `l-${date}`,
  habitId: 'h',
  date,
  count: 1,
  status: 'done',
  reasonCode: null,
  reason: null,
});

describe('humeur et habitudes', () => {
  it('compare l’énergie des jours avec et sans l’habitude', () => {
    const logs = [
      mood('2026-09-20', 4, 5),
      mood('2026-09-21', 4, 4),
      mood('2026-09-22', 2, 2),
      mood('2026-09-23', 3, 1),
    ];
    const r = moodInsights(logs, [sport], [done('2026-09-20'), done('2026-09-21')], '2026-09-23');
    expect(r.week).toEqual({ days: 4, mood: 3.3, energy: 3 });
    expect(r.habits[0]).toMatchObject({ energyDone: 4.5, energyMissed: 1.5 });
  });

  it('pas assez de jours : pas de comparaison', () => {
    const r = moodInsights([mood('2026-09-23', 3, 3)], [sport], [], '2026-09-23');
    expect(r.habits).toEqual([]);
  });
});
