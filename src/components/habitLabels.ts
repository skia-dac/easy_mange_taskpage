import { formatPercent } from '@/shared/format';
import type { TFunction } from 'i18next';

import type { Habit } from '@/modules/productivity';

/** « Tous les jours », « Lun · Mer · Ven », « 3 fois par semaine ». */
export function frequencyLabel(
  habit: Pick<Habit, 'frequency' | 'weekdays' | 'timesPerWeek'>,
  t: TFunction,
  weekday: (n: number, style: 'short' | 'long') => string,
): string {
  if (habit.frequency === 'daily') return t('habits.freq.daily');
  if (habit.frequency === 'weekly')
    return t('habits.freq.weeklyCount', { count: habit.timesPerWeek });
  return habit.weekdays.map((d) => weekday(d, 'short')).join(' · ');
}

/** Taux 0–1 → « 75 % » ; null → « — ». */
export function percent(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}
