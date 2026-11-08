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
  /** Filet de sécurité : « Ouvre MySky pour garder tes rappels à jour » (ouvre Aujourd'hui). */
  z.object({ kind: z.literal('refresh') }),
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
/**
 * Part du quota réservée aux rappels de cours (début et fin de séance) : au-delà, la place
 * restante revient aux devoirs, examens, événements, habitudes… qui sinon n'y entreraient jamais
 * (5 cours par jour remplissent 60 rappels en 6 jours).
 */
export const MAX_COURSE_REMINDERS = 40;
export const HORIZON_DAYS = 45;
/**
 * Rappels quotidiens (habitudes, bilan du soir) : au moins une semaine, et plus quand le quota
 * le permet (voir `dailyHorizonDays`), jusqu'à MAX_HABIT_HORIZON_DAYS.
 */
export const HABIT_HORIZON_DAYS = 7;
export const MAX_HABIT_HORIZON_DAYS = 28;
/**
 * Filet de sécurité : une notification douce juste avant la fin des rappels programmés, pour
 * qu'un étudiant qui n'ouvre pas l'app ne perde pas ses rappels sans le savoir. Le matin du
 * dernier jour couvert, sinon la veille au soir.
 */
export const SAFETY_NET_MORNING = '09:00';
export const SAFETY_NET_EVENING = '19:00';
/** Rappel avant une séance de révision. */
export const REVISION_REMINDER_MINUTES = 10;

type Named = { subjectName: (id: string) => string };

export type PlanOptions = {
  /**
   * Jour (AAAA-MM-JJ) du premier bilan du soir : ce rappel-là explique ce qu'il est et comment
   * le couper (voir `firstReviewDay`). null : aucun rappel d'introduction.
   */
  reviewIntroDate?: string | null;
};

const byDate = (a: PlannedReminder, b: PlannedReminder) => a.fireAt.getTime() - b.fireAt.getTime();

/** Jour du prochain bilan du soir : aujourd'hui si l'heure n'est pas passée, sinon demain. */
export function firstReviewDay(
  prefs: Pick<NotificationPreferences, 'eveningReviewTime'>,
  now: Date,
): string {
  const today = toIsoDate(now);
  const at = atTime(today, prefs.eveningReviewTime ?? '20:30');
  return at.getTime() > now.getTime() ? today : addDaysIso(today, 1);
}

/**
 * Nombre de jours de rappels quotidiens : la place laissée par les autres rappels (une place
 * gardée pour le filet de sécurité), divisée par le nombre de rappels par jour. Jamais moins
 * d'une semaine (comportement d'avant : le plus proche d'abord), jamais plus de 4 semaines.
 */
export function dailyHorizonDays(otherCount: number, perDay: number): number {
  if (perDay <= 0) return HABIT_HORIZON_DAYS;
  const free = MAX_SCHEDULED - 1 - otherCount;
  const days = Math.floor(free / perDay);
  return Math.min(MAX_HABIT_HORIZON_DAYS, Math.max(HABIT_HORIZON_DAYS, days));
}

/** Nombre de rappels gardés une fois le quota des cours appliqué (sans le quota total). */
function countAfterCourseCap(reminders: readonly PlannedReminder[]): number {
  const courses = reminders.filter(isCourseReminder).length;
  return reminders.length - courses + Math.min(courses, MAX_COURSE_REMINDERS);
}

/**
 * Calcule tous les rappels à venir (dans les prochains jours), triés par date, limités à
 * MAX_SCHEDULED. Fonction pure : facile à tester, et relancée à chaque changement de données.
 */
export function planReminders(
  data: TodayData,
  prefs: NotificationPreferences,
  now: Date,
  names: Named,
  options: PlanOptions = {},
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
      body: w.dueDate
        ? {
            key: 'notif.workBody',
            params: { title: w.title, date: w.dueDate, time: w.dueTime ?? '' },
          }
        : { key: 'notif.workBodyNoDate', params: { title: w.title } },
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

  // Rappels quotidiens : planifiés sur autant de jours que le quota restant le permet.
  const others = applyFocus(out, data, prefs, now);
  const withReminder =
    prefs.habits !== false ? (data.habits ?? []).filter((h) => h.reminderTime) : [];
  const perDay = withReminder.length + (prefs.eveningReview ? 1 : 0);
  const days = dailyHorizonDays(countAfterCourseCap(others), perDay);
  const daily: PlannedReminder[] = [];

  if (prefs.habits !== false) {
    for (const h of withReminder) {
      if (!h.reminderTime) continue;
      for (let i = 0; i < days; i++) {
        const day = addDaysIso(today, i);
        const state = dayState(h, data.habitLogs ?? [], day, today);
        if (state !== 'pending' && state !== 'partial') continue;
        const at = atTime(day, h.reminderTime);
        if (!future(at)) continue;
        daily.push({
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

  if (prefs.eveningReview) {
    const time = prefs.eveningReviewTime ?? '20:30';
    for (let i = 0; i < days; i++) {
      const day = addDaysIso(today, i);
      const at = atTime(day, time);
      if (!future(at)) continue;
      daily.push({
        id: `review:${day}`,
        fireAt: at,
        title: { key: 'notif.reviewTitle' },
        // Le premier bilan dit ce qu'il est et comment le couper (activé par défaut).
        body: {
          key: day === options.reviewIntroDate ? 'notif.reviewBodyFirst' : 'notif.reviewBody',
        },
        action: { kind: 'review', date: day },
      });
    }
  }

  const all = [...others, ...applyFocus(daily, data, prefs, now)].sort(byDate);
  return withSafetyNet(all, data, prefs, now, until);
}

/** Groupe des rappels qui se répètent (ceux qui s'arrêtent si le plan n'est pas recalculé). */
function recurringGroup(r: PlannedReminder): 'course' | 'habit' | 'review' | 'money' | null {
  if (isCourseReminder(r)) return 'course';
  if (r.action.kind === 'habit') return 'habit';
  if (r.action.kind === 'review') return 'review';
  if (r.action.kind === 'money' && r.id.startsWith('money:')) return 'money';
  return null;
}

/**
 * Ajoute le filet de sécurité au plan, en restant dans le quota : le plan est d'abord limité à
 * MAX_SCHEDULED − 1, puis la notification « Ouvre MySky… » est placée juste avant la fin de ce
 * qui est couvert. Sans rappel répétitif (rien ne s'arrêtera), pas de filet et tout le quota.
 */
function withSafetyNet(
  sorted: readonly PlannedReminder[],
  data: TodayData,
  prefs: NotificationPreferences,
  now: Date,
  until: string,
): PlannedReminder[] {
  const kept = capReminders(sorted, MAX_SCHEDULED - 1);
  const net = safetyNet(sorted, kept, data, prefs, now, until);
  return net ? [...kept, net].sort(byDate) : capReminders(sorted);
}

/**
 * Moment du filet : avant le premier rappel qui ne serait plus programmé si l'app restait
 * fermée. C'est le plus tôt entre le dernier rappel quotidien gardé (habitudes, bilan), le
 * premier rappel écarté par le quota, et la fin de l'horizon des cours et charges (45 jours).
 * Le matin de ce jour s'il tombe avant, sinon la veille au soir ; jamais dans le passé ni
 * pendant un moment de focus.
 */
export function safetyNet(
  sorted: readonly PlannedReminder[],
  kept: readonly PlannedReminder[],
  data: TodayData,
  prefs: NotificationPreferences,
  now: Date,
  until: string,
): PlannedReminder | null {
  const lastDaily = new Map<string, number>();
  let longHorizon = false;
  for (const r of kept) {
    const group = recurringGroup(r);
    if (group === 'habit' || group === 'review') lastDaily.set(group, r.fireAt.getTime());
    else if (group) longHorizon = true;
  }
  if (lastDaily.size === 0 && !longHorizon) return null;
  const limits = [...lastDaily.values()];
  if (longHorizon) limits.push(atTime(until, '23:59').getTime());
  const keptSet = new Set(kept);
  const dropped = sorted.find((r) => !keptSet.has(r));
  if (dropped) limits.push(dropped.fireAt.getTime());
  const limit = Math.min(...limits);
  const day = toIsoDate(new Date(limit));
  const candidates = [
    atTime(day, SAFETY_NET_MORNING),
    atTime(addDaysIso(day, -1), SAFETY_NET_EVENING),
  ];
  for (const at of candidates) {
    if (at.getTime() <= now.getTime() || at.getTime() >= limit) continue;
    const net: PlannedReminder = {
      id: `refresh:${toIsoDate(at)}`,
      fireAt: at,
      title: { key: 'notif.refreshTitle' },
      body: { key: 'notif.refreshBody' },
      action: { kind: 'refresh' },
    };
    if (applyFocus([net], data, prefs, now).length > 0) return net;
  }
  return null;
}

/** Le filet de sécurité n'est pas un vrai rappel (compté à part dans l'état des rappels). */
export const isSafetyNet = (r: PlannedReminder) => r.action.kind === 'refresh';

const isCourseReminder = (r: PlannedReminder) =>
  r.action.kind === 'course' || r.action.kind === 'endOfCourse';

/**
 * Limite à MAX_SCHEDULED rappels, les plus proches d'abord, avec au plus MAX_COURSE_REMINDERS
 * rappels de cours : le reste du quota va aux autres rappels, même plus lointains.
 */
export function capReminders(
  sorted: readonly PlannedReminder[],
  max: number = MAX_SCHEDULED,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  let courses = 0;
  for (const r of sorted) {
    if (out.length >= max) break;
    if (isCourseReminder(r)) {
      if (courses >= MAX_COURSE_REMINDERS) continue;
      courses += 1;
    }
    out.push(r);
  }
  return out;
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
