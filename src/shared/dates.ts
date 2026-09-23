import { addDays, differenceInCalendarDays, format, getISODay, isValid, parse } from 'date-fns';

/** Date au format « AAAA-MM-JJ », sans heure (jour local). */
export type IsoDate = string;
/** Heure au format « HH:MM » (24 h). */
export type Time = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value: string): boolean {
  return DATE_RE.test(value) && isValid(parse(value, 'yyyy-MM-dd', new Date()));
}

export function isTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

/** Minuit (heure locale) du jour donné. */
export function fromIsoDate(value: IsoDate): Date {
  return parse(value, 'yyyy-MM-dd', new Date());
}

export function addDaysIso(value: IsoDate, days: number): IsoDate {
  return toIsoDate(addDays(fromIsoDate(value), days));
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(value: IsoDate): number {
  return getISODay(fromIsoDate(value));
}

/** Nombre de jours de `from` à `to` (positif si `to` est après). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(fromIsoDate(to), fromIsoDate(from));
}

export function timeToMinutes(value: Time): number {
  const [h, m] = value.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function toTime(date: Date): Time {
  return format(date, 'HH:mm');
}

/** Date + heure locales → objet Date. */
export function atTime(day: IsoDate, time: Time): Date {
  const d = fromIsoDate(day);
  d.setHours(...(time.split(':').map(Number) as [number, number]), 0, 0);
  return d;
}

/** Lundi de la semaine qui contient `value`. */
export function startOfIsoWeek(value: IsoDate): IsoDate {
  return addDaysIso(value, 1 - isoWeekday(value));
}
