import { fromIsoDate, type IsoDate } from './dates';
import { i18n } from './i18n';

const cap = (text: string, locale: string) =>
  text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);

/** « mercredi 23 septembre » → « Mercredi 23 septembre », selon la langue. */
export function formatLongDate(date: Date, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return cap(text, locale);
}

/** « mer. 23 sept. » */
export function formatShortDate(day: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(fromIsoDate(day));
}

/** « 23 sept. 2026 » */
export function formatDate(day: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fromIsoDate(day));
}

/** « Septembre 2026 » */
export function formatMonthYear(day: IsoDate, locale: string): string {
  return cap(
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(fromIsoDate(day)),
    locale,
  );
}

/** Jour de la semaine (1 = lundi) : « lun. » ou « lundi ». */
export function weekdayName(
  isoWeekday: number,
  locale: string,
  style: 'short' | 'long' = 'long',
): string {
  // Le 21 septembre 2026 est un lundi.
  const d = new Date(2026, 8, 20 + isoWeekday);
  return new Intl.DateTimeFormat(locale, { weekday: style }).format(d);
}

/** Durée : « 35 min », « 1 h », « 1 h 20 ». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return i18n.t('units.min', { value: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0
    ? i18n.t('units.h', { value: h })
    : i18n.t('units.hm', { h, m: String(m).padStart(2, '0') });
}

/** « 62,5 kg » */
export function formatKg(value: number, locale: string): string {
  return i18n.t('units.kg', {
    value: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value),
  });
}

/** Taux 0–1 → « 75 % » (espace fine selon la langue). */
export function formatPercent(rate: number): string {
  return i18n.t('units.percent', { value: Math.round(rate * 100) });
}

/** « 24 sept. 2026, 10:30 » */
export function formatDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** « sept. » (mois court, grille de progression). */
export function formatMonthShort(day: IsoDate, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(fromIsoDate(day));
}
