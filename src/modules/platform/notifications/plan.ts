import { occurrencesInRange, type Occurrence } from '@/modules/academic';
import type { NotificationPreferences } from '@/modules/identity';
import type { TodayData } from '@/projections';
import { addDaysIso, atTime, toIsoDate } from '@/shared/dates';

/** Ce que l'app fait quand l'utilisateur touche la notification. */
export type ReminderAction =
  | { kind: 'course'; seriesId: string; date: string }
  | { kind: 'endOfCourse'; seriesId: string; date: string; subjectId: string }
  | { kind: 'work'; workKind: 'task' | 'assignment'; id: string }
  | { kind: 'exam'; id: string }
  | { kind: 'event'; id: string };

export type PlannedReminder = {
  /** Identifiant stable (même donnée → même id), utile pour le débogage. */
  id: string;
  fireAt: Date;
  /** Clé de traduction du titre et du corps, avec leurs variables. */
  title: { key: string; params?: Record<string, string | number> };
  body: { key: string; params?: Record<string, string | number> };
  action: ReminderAction;
  category?: 'endOfCourse';
};

/** iOS garde au plus 64 notifications programmées : on en planifie moins, par ordre de date. */
export const MAX_SCHEDULED = 60;
export const HORIZON_DAYS = 45;

type Named = { subjectName: (id: string) => string };

/**
 * Calcule tous les rappels à venir (dans les prochains jours), triés par date, limités à
 * MAX_SCHEDULED. Fonction pure : facile à tester, et relancée à chaque changement de données.
 */
export function planReminders(
  data: TodayData,
  prefs: NotificationPreferences,
  now: Date,
  names: Named,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const today = toIsoDate(now);
  const until = addDaysIso(today, HORIZON_DAYS);
  const future = (d: Date) => d.getTime() > now.getTime();

  if (prefs.courses || prefs.endOfCourse) {
    const occurrences = occurrencesInRange(data.series, today, until, data);
    for (const o of occurrences) {
      if (o.status === 'cancelled') continue;
      const series = data.series.find((s) => s.id === o.seriesId);
      const minutes = series?.reminderMinutes ?? prefs.courseReminderMinutes;
      const subject = names.subjectName(o.subjectId);
      if (prefs.courses && minutes > 0) {
        const at = new Date(atTime(o.date, o.startTime).getTime() - minutes * 60_000);
        if (future(at)) {
          out.push({
            id: `course:${o.seriesId}:${o.date}`,
            fireAt: at,
            title: { key: 'notif.courseTitle', params: { subject: o.title ?? subject } },
            body: {
              key: 'notif.courseBody',
              params: { minutes, time: o.startTime, room: o.room ?? '' },
            },
            action: { kind: 'course', seriesId: o.seriesId, date: o.date },
          });
        }
      }
      if (prefs.endOfCourse) {
        const at = atTime(o.date, o.endTime);
        if (future(at)) {
          out.push({
            id: `end:${o.seriesId}:${o.date}`,
            fireAt: at,
            title: { key: 'notif.endTitle', params: { subject: o.title ?? subject } },
            body: { key: 'notif.endBody' },
            action: {
              kind: 'endOfCourse',
              seriesId: o.seriesId,
              date: o.date,
              subjectId: o.subjectId,
            },
            category: 'endOfCourse',
          });
        }
      }
    }
  }

  for (const w of data.work) {
    const enabled = w.kind === 'task' ? prefs.tasks : prefs.assignments;
    if (!enabled || w.status === 'done' || !w.reminderAt) continue;
    const at = new Date(w.reminderAt);
    if (Number.isNaN(at.getTime()) || !future(at)) continue;
    out.push({
      id: `work:${w.kind}:${w.id}`,
      fireAt: at,
      title: { key: w.kind === 'task' ? 'notif.taskTitle' : 'notif.assignmentTitle' },
      body: {
        key: 'notif.workBody',
        params: { title: w.title, date: w.dueDate, time: w.dueTime ?? '' },
      },
      action: { kind: 'work', workKind: w.kind, id: w.id },
    });
  }

  if (prefs.events) {
    for (const e of data.events) {
      if (!e.reminderAt) continue;
      const at = new Date(e.reminderAt);
      if (Number.isNaN(at.getTime()) || !future(at)) continue;
      out.push({
        id: `event:${e.id}`,
        fireAt: at,
        title: { key: 'notif.eventTitle', params: { title: e.title } },
        body: { key: 'notif.eventBody', params: { date: e.date, time: e.startTime ?? '' } },
        action: { kind: 'event', id: e.id },
      });
    }
  }

  if (prefs.exams) {
    for (const e of data.exams) {
      for (const days of new Set(e.reminderDays)) {
        const day = addDaysIso(e.date, -days);
        const at = atTime(day, e.reminderTime);
        if (!future(at)) continue;
        out.push({
          id: `exam:${e.id}:${days}`,
          fireAt: at,
          title: { key: 'notif.examTitle', params: { subject: names.subjectName(e.subjectId) } },
          body: {
            key: days === 0 ? 'notif.examToday' : 'notif.examBody',
            params: { days, time: e.time ?? '' },
          },
          action: { kind: 'exam', id: e.id },
        });
      }
    }
  }

  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_SCHEDULED);
}

/** Pour les tests et l'écran de réglages : la prochaine séance concernée par un rappel. */
export function nextOccurrenceAfter(data: TodayData, now: Date): Occurrence | undefined {
  const today = toIsoDate(now);
  return occurrencesInRange(data.series, today, addDaysIso(today, 7), data).find(
    (o) => o.status !== 'cancelled' && atTime(o.date, o.startTime).getTime() > now.getTime(),
  );
}
