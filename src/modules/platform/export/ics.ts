import { occurrencesInRange } from '@/modules/academic';
import type { TodayData } from '@/projections';
import { addDaysIso, atTime, toIsoDate, type IsoDate } from '@/shared/dates';

type Labels = {
  subjectName: (id: string) => string;
  /** Préfixes traduits : « Examen », « Devoir », « Tâche ». */
  exam: string;
  assignment: string;
  task: string;
};

/** Jours exportés avant et après aujourd'hui. */
export const ICS_PAST_DAYS = 30;
export const ICS_FUTURE_DAYS = 180;

/** Échappement du texte selon la RFC 5545 (virgules, points-virgules, retours à la ligne). */
export function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** Coupe les lignes à 75 octets (RFC 5545 §3.1) : suite de ligne = espace en tête. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  out.push(rest);
  return out.join('\r\n');
}

/** Heure locale « flottante » (sans fuseau) : elle s'affiche telle quelle dans le calendrier du téléphone. */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function dateStamp(day: IsoDate): string {
  return day.replace(/-/g, '');
}

type Event = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  /** Soit un créneau, soit un jour entier. */
  start?: Date;
  end?: Date;
  allDay?: IsoDate;
};

function vevent(e: Event, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}@mysky`, `DTSTAMP:${stamp}`];
  if (e.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(e.allDay)}`);
    lines.push(`DTEND;VALUE=DATE:${dateStamp(addDaysIso(e.allDay, 1))}`);
  } else if (e.start && e.end) {
    lines.push(`DTSTART:${localStamp(e.start)}`, `DTEND:${localStamp(e.end)}`);
  }
  lines.push(`SUMMARY:${icsEscape(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

/**
 * Calendrier iCalendar (.ics) : séances de cours (hors annulées), examens, événements,
 * devoirs et tâches (jour entier). Fonction pure, testée.
 */
export function buildIcs(data: TodayData, labels: Labels, now = new Date()): string {
  const today = toIsoDate(now);
  const from = addDaysIso(today, -ICS_PAST_DAYS);
  const to = addDaysIso(today, ICS_FUTURE_DAYS);
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const events: Event[] = [];

  for (const o of occurrencesInRange(data.series, from, to, data)) {
    if (o.status === 'cancelled') continue;
    events.push({
      uid: `course-${o.seriesId}-${o.date}`,
      summary: o.title ?? labels.subjectName(o.subjectId),
      location: o.room,
      description: o.teacher,
      start: atTime(o.date, o.startTime),
      end: atTime(o.date, o.endTime),
    });
  }
  for (const e of data.exams) {
    if (e.date < from || e.date > to) continue;
    const summary = `${labels.exam} : ${e.title ?? labels.subjectName(e.subjectId)}`;
    if (e.time) {
      const start = atTime(e.date, e.time);
      const end = new Date(start.getTime() + (e.durationMinutes ?? 120) * 60_000);
      events.push({ uid: `exam-${e.id}`, summary, location: e.room, start, end });
    } else events.push({ uid: `exam-${e.id}`, summary, location: e.room, allDay: e.date });
  }
  for (const e of data.events) {
    if (e.date < from || e.date > to) continue;
    if (e.startTime) {
      const start = atTime(e.date, e.startTime);
      const end = e.endTime ? atTime(e.date, e.endTime) : new Date(start.getTime() + 60 * 60_000);
      events.push({
        uid: `event-${e.id}`,
        summary: e.title,
        description: e.description,
        start,
        end,
      });
    } else events.push({ uid: `event-${e.id}`, summary: e.title, allDay: e.date });
  }
  for (const w of data.work) {
    if (w.status === 'done' || w.dueDate < from || w.dueDate > to) continue;
    const prefix = w.kind === 'task' ? labels.task : labels.assignment;
    events.push({ uid: `${w.kind}-${w.id}`, summary: `${prefix} : ${w.title}`, allDay: w.dueDate });
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MySky//MySky//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:MySky',
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
