import type { TFunction } from 'i18next';

import type { Recurring } from '@/modules/finance';

type WeekdayName = (n: number, style?: 'short' | 'long') => string;

/** « Le 1er de chaque mois », « Chaque samedi à 15:00 ». */
export function recurringWhen(r: Recurring, t: TFunction, weekday: WeekdayName): string {
  const base =
    r.frequency === 'weekly'
      ? t('money.everyWeekday', { day: weekday(r.weekday) })
      : t('money.everyMonthDay', { day: r.dayOfMonth });
  return r.time ? t('money.atTime', { when: base, time: r.time }) : base;
}

/** « la veille, 3 h avant » */
export function remindersText(minutes: readonly number[], t: TFunction): string {
  return minutes
    .map((m) =>
      t(`money.reminder.${m}`, { defaultValue: t('money.reminder.minutes', { count: m }) }),
    )
    .join(', ');
}
