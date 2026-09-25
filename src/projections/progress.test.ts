import type { Habit, HabitLog } from '@/modules/productivity';

import { habitLevel, heatWeeks, overallLevel, progressStats, YEAR_WEEKS } from './progress';

const sport: Habit = {
  id: 'sport',
  name: 'Sport',
  icon: 'activity',
  colorId: 'green',
  frequency: 'weekdays',
  weekdays: [1, 3, 5],
  timesPerWeek: 3,
  target: 1,
  unit: null,
  reminderTime: null,
  archived: false,
  position: 0,
} as unknown as Habit;
const water: Habit = {
  ...sport,
  id: 'water',
  frequency: 'daily',
  weekdays: [],
  target: 8,
} as Habit;
const log = (
  habitId: string,
  date: string,
  count = 1,
  status: HabitLog['status'] = 'done',
): HabitLog => ({
  id: `${habitId}-${date}`,
  habitId,
  date,
  count,
  status,
  reasonCode: null,
  reason: null,
});
// Mercredi 23 septembre 2026.
const today = '2026-09-23';

describe('grille de progression (façon GitHub)', () => {
  const logs = [
    log('sport', '2026-09-21'),
    log('water', '2026-09-22', 4),
    log('sport', '2026-09-18'),
  ];

  it('niveau d’une habitude : fait = 4, à moitié = 2, raté = 0, pas prévu = rien', () => {
    expect(habitLevel(sport, logs, '2026-09-21', today)).toBe(4);
    expect(habitLevel(sport, logs, '2026-09-22', today)).toBeNull(); // mardi : pas prévu
    expect(habitLevel(sport, logs, '2026-09-16', today)).toBe(0); // mercredi raté
    expect(habitLevel(water, logs, '2026-09-22', today)).toBe(2); // 4 verres sur 8
    expect(habitLevel(sport, logs, '2026-09-25', today)).toBeNull(); // à venir
  });

  it('toutes les habitudes : la part réussie du jour', () => {
    expect(overallLevel([sport, water], logs, '2026-09-21', today)).toBe(2);
    expect(overallLevel([sport, water], logs, '2026-09-22', today)).toBe(2);
  });

  it('semaine, mois et année : les bonnes cases', () => {
    const lvl = (d: string) => habitLevel(sport, logs, d, today);
    const week = heatWeeks('week', today, 1, lvl);
    expect(week).toHaveLength(1);
    expect(week[0]!.map((c) => c.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    const month = heatWeeks('month', today, 1, lvl);
    expect(month[0]![0]!.date).toBe('2026-08-31');
    expect(month[0]![0]!.outside).toBe(true);
    expect(month.flat().filter((c) => !c.outside)).toHaveLength(30);
    const year = heatWeeks('year', today, 1, lvl);
    expect(year).toHaveLength(YEAR_WEEKS);
    expect(year.at(-1)![6]!.future).toBe(true);
  });

  it('bilan : jours réussis et meilleure série (les jours non prévus ne cassent pas la série)', () => {
    const weeks = heatWeeks('month', today, 1, (d) => habitLevel(sport, logs, d, today));
    const s = progressStats(weeks);
    expect(s.doneDays).toBe(2);
    expect(s.bestRun).toBe(2);
  });
});
