import { fromIsoDate, type IsoDate } from './dates';

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
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
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
