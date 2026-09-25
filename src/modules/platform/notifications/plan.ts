import { z } from 'zod';

import { occurrencesInRange, type Occurrence } from '@/modules/academic';
import { formatMoney, occurrencesBetween } from '@/modules/finance';
import { dayState, plannedEnd } from '@/modules/productivity';
import type { NotificationPreferences } from '@/modules/identity';
import type { TodayData } from '@/projections';
import { addDaysIso, atTime, toIsoDate } from '@/shared/dates';

const id = z.string().min(1);
/**
 * Ce que l'app fait quand l'utilisateur touche la notification. Schéma zod : les données d'une
 * notification viennent du système (ancienne version de l'app, contenu altéré), on les vérifie.
 */
export const reminderActionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('course'), seriesId: id, date: z.string() }),
  z.object({ kind: z.literal('endOfCourse'), seriesId: id, date: z.string(), subjectId: id }),
  z.object({ kind: z.literal('work'), workKind: z.enum(['task', 'assignment']), id }),
  z.object({ kind: z.literal('exam'), id }),
  z.object({ kind: z.literal('event'), id }),
  z.object({ kind: z.literal('study'), id }),
  z.object({ kind: z.literal('habit'), id }),
  z.object({ kind: z.literal('revision'), id }),
  z.object({ kind: z.literal('review'), date: z.string() }),
  z.object({ kind: z.literal('money'), id }),
]);
export type ReminderAction = z.infer<typeof reminderActionSchema>;

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
/** Les rappels d'habitudes sont planifiés sur une semaine (ils se répètent chaque jour). */
export const HABIT_HORIZON_DAYS = 7;
/** Rappel avant une séance de révision. */
export const REVISION_REMINDER_MINUTES = 10;

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
            id: `course:${o.seriesId}:${o.originalDate}`,
            fireAt: at,
            title: { key: 'notif.courseTitle', params: { subject: o.title ?? subject } },
            body: {
              key: 'notif.courseBody',
              params: { minutes, time: o.startTime, room: o.room ?? '' },
            },
            action: { kind: 'course', seriesId: o.seriesId, date: o.originalDate },
          });
        }
      }
      if (prefs.endOfCourse) {
        const at = atTime(o.date, o.endTime);
        if (future(at)) {
          out.push({
            id: `end:${o.seriesId}:${o.originalDate}`,
            fireAt: at,
            title: { key: 'notif.endTitle', params: { subject: o.title ?? subject } },
            body: { key: 'notif.endBody' },
            action: {
              kind: 'endOfCourse',
              seriesId: o.seriesId,
              date: o.originalDate,
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
            params: { count: days, time: e.time ?? '' },
          },
          action: { kind: 'exam', id: e.id },
        });
      }
    }
  }

  const session = data.studySession;
  if (session && session.endedAt === null) {
    const at = plannedEnd(session);
    if (future(at)) {
      out.push({
        id: `study:${session.id}`,
        fireAt: at,
        title: { key: session.kind === 'break' ? 'notif.breakEndTitle' : 'notif.studyEndTitle' },
        body: {
          key: session.kind === 'break' ? 'notif.breakEndBody' : 'notif.studyEndBody',
          params: { minutes: session.plannedMinutes },
        },
        action: { kind: 'study', id: session.id },
      });
    }
  }

  if (prefs.habits !== false) {
    // 7 jours suffisent : le plan est recalculé à chaque ouverture de l'app.
    for (const h of data.habits ?? []) {
      if (!h.reminderTime) continue;
      for (let i = 0; i < HABIT_HORIZON_DAYS; i++) {
        const day = addDaysIso(today, i);
        const state = dayState(h, data.habitLogs ?? [], day, today);
        if (state !== 'pending' && state !== 'partial') continue;
        const at = atTime(day, h.reminderTime);
        if (!future(at)) continue;
        out.push({
          id: `habit:${h.id}:${day}`,
          fireAt: at,
          title: { key: 'notif.habitTitle', params: { name: h.name } },
          body: {
            key: h.target > 1 ? 'notif.habitBodyCount' : 'notif.habitBody',
            params: { target: h.target, unit: h.unit ?? '' },
          },
          action: { kind: 'habit', id: h.id },
        });
      }
    }
  }

  if (prefs.revisions !== false) {
    for (const b of data.revisionBlocks ?? []) {
      if (b.status !== 'planned' || b.date < today || b.date > until) continue;
      const at = new Date(
        atTime(b.date, b.startTime).getTime() - REVISION_REMINDER_MINUTES * 60_000,
      );
      if (!future(at)) continue;
      const subject = b.subjectId ? names.subjectName(b.subjectId) : '';
      out.push({
        id: `revision:${b.id}`,
        fireAt: at,
        title: {
          key: subject ? 'notif.revisionTitle' : 'notif.revisionTitlePlain',
          params: { subject },
        },
        body: {
          key: 'notif.revisionBody',
          params: { minutes: REVISION_REMINDER_MINUTES, time: b.startTime },
        },
        action: { kind: 'revision', id: b.id },
      });
    }
  }

  if (prefs.money !== false && data.money) {
    const paid = new Set(
      data.money.payments
        .filter((p) => p.recurringId && p.occurrenceDate && p.kind === 'expense')
        .map((p) => `${p.recurringId}|${p.occurrenceDate}`),
    );
    for (const r of data.money.recurring) {
      const amount = formatMoney(r.amountMinor, r.currency);
      const time = r.time ?? '09:00';
      for (const date of occurrencesBetween(r, today, until)) {
        if (paid.has(`${r.id}|${date}`)) continue;
        for (const minutes of r.reminders) {
          const at = new Date(atTime(date, time).getTime() - minutes * 60_000);
          if (!future(at)) continue;
          out.push({
            id: `money:${r.id}:${date}:${minutes}`,
            fireAt: at,
            title: {
              key: r.kind === 'tontine' ? 'notif.tontineTitle' : 'notif.chargeTitle',
              params: { name: r.name },
            },
            body: {
              key: r.time ? 'notif.moneyBodyTime' : 'notif.moneyBody',
              params: { amount, date, time: r.time ?? '' },
            },
            action: { kind: 'money', id: r.id },
          });
        }
      }
      if (
        r.kind === 'tontine' &&
        r.active &&
        r.payoutDate &&
        r.payoutMinor &&
        r.payoutDate >= today
      ) {
        const at = atTime(r.payoutDate, r.time ?? '09:00');
        if (future(at) && r.payoutDate <= until) {
          out.push({
            id: `payout:${r.id}:${r.payoutDate}`,
            fireAt: at,
            title: { key: 'notif.payoutTitle', params: { name: r.name } },
            body: {
              key: 'notif.payoutBody',
              params: { amount: formatMoney(r.payoutMinor, r.currency) },
            },
            action: { kind: 'money', id: r.id },
          });
        }
      }
    }
  }

  if (prefs.eveningReview) {
    const time = prefs.eveningReviewTime ?? '20:30';
    for (let i = 0; i < HABIT_HORIZON_DAYS; i++) {
      const day = addDaysIso(today, i);
      const at = atTime(day, time);
      if (!future(at)) continue;
      out.push({
        id: `review:${day}`,
        fireAt: at,
        title: { key: 'notif.reviewTitle' },
        body: { key: 'notif.reviewBody' },
        action: { kind: 'review', date: day },
      });
    }
  }

  const kept = applyFocus(out, data, prefs, now);
  return kept.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_SCHEDULED);
}

type Window = { from: number; to: number };

/**
 * Mode focus : retire les rappels qui tomberaient pendant un cours ou une session de révision.
 * La fin de cours et la fin de session restent : ce sont elles qui marquent la sortie du focus.
 */
export function applyFocus(
  reminders: PlannedReminder[],
  data: TodayData,
  prefs: Pick<NotificationPreferences, 'focusDuringCourses' | 'focusDuringStudy'>,
  now: Date,
): PlannedReminder[] {
  const windows: Window[] = [];
  if (prefs.focusDuringCourses) {
    const today = toIsoDate(now);
    for (const o of occurrencesInRange(data.series, today, addDaysIso(today, HORIZON_DAYS), data)) {
      if (o.status === 'cancelled') continue;
      windows.push({
        from: atTime(o.date, o.startTime).getTime(),
        to: atTime(o.date, o.endTime).getTime(),
      });
    }
  }
  const session = data.studySession;
  if (prefs.focusDuringStudy && session && session.endedAt === null && session.kind === 'focus') {
    windows.push({
      from: new Date(session.startedAt).getTime(),
      to: plannedEnd(session).getTime(),
    });
  }
  if (windows.length === 0) return reminders;
  const exempt = (r: PlannedReminder) =>
    r.action.kind === 'endOfCourse' || r.action.kind === 'study';
  return reminders.filter((r) => {
    if (exempt(r)) return true;
    const t = r.fireAt.getTime();
    return !windows.some((w) => w.from <= t && t < w.to);
  });
}

/** Pour les tests et l'écran de réglages : la prochaine séance concernée par un rappel. */
export function nextOccurrenceAfter(data: TodayData, now: Date): Occurrence | undefined {
  const today = toIsoDate(now);
  return occurrencesInRange(data.series, today, addDaysIso(today, 7), data).find(
    (o) => o.status !== 'cancelled' && atTime(o.date, o.startTime).getTime() > now.getTime(),
  );
}
