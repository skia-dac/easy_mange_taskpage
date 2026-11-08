import { z } from 'zod';

import type { NotificationPreferences } from '@/modules/identity';
import { readAppSetting, writeAppSetting, type Db } from '@/shared/db';

import { isSafetyNet, type PlannedReminder } from './plan';

/**
 * Résultat du dernier passage réussi du planificateur (`app_settings`, propre au téléphone) :
 * combien de rappels sont programmés, jusqu'à quand, et quand le plan a été programmé. Réglages ›
 * Notifications l'affiche (« Rappels actifs : 23 programmés, jusqu'au 14 déc. »).
 */
export const REMINDER_STATUS_KEY = 'reminder_status';
/** Jour (AAAA-MM-JJ) du premier bilan du soir, celui qui s'explique (voir `PlanOptions`). */
export const REVIEW_INTRO_KEY = 'evening_review_intro';

const iso = z.string().refine((v) => !Number.isNaN(Date.parse(v)));

export const reminderRunStatusSchema = z.object({
  /** Rappels programmés, sans le filet de sécurité. */
  count: z.number().int().min(0),
  /** Date (ISO) du dernier rappel programmé, ou null s'il n'y en a aucun. */
  lastAt: iso.nullable(),
  /** Date (ISO) de la programmation. */
  ranAt: iso,
  /** Date (ISO) du filet « Ouvre MySky pour garder tes rappels à jour », ou null. */
  safetyNetAt: iso.nullable(),
});
export type ReminderRunStatus = z.infer<typeof reminderRunStatusSchema>;

/** Résume un plan programmé pour l'écran des réglages. */
export function summarizePlan(plan: readonly PlannedReminder[], now: Date): ReminderRunStatus {
  const real = plan.filter((r) => !isSafetyNet(r));
  const last = real.reduce<Date | null>(
    (max, r) => (max === null || r.fireAt > max ? r.fireAt : max),
    null,
  );
  const net = plan.find(isSafetyNet);
  return {
    count: real.length,
    lastAt: last ? last.toISOString() : null,
    ranAt: now.toISOString(),
    safetyNetAt: net ? net.fireAt.toISOString() : null,
  };
}

export async function getReminderRunStatus(db: Db): Promise<ReminderRunStatus | null> {
  const parsed = reminderRunStatusSchema.safeParse(await readAppSetting(db, REMINDER_STATUS_KEY));
  return parsed.success ? parsed.data : null;
}

export async function setReminderRunStatus(db: Db, status: ReminderRunStatus): Promise<void> {
  await writeAppSetting(db, REMINDER_STATUS_KEY, reminderRunStatusSchema.parse(status));
}

export async function getReviewIntroDate(db: Db): Promise<string | null> {
  const v = await readAppSetting(db, REVIEW_INTRO_KEY);
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function setReviewIntroDate(db: Db, day: string): Promise<void> {
  await writeAppSetting(db, REVIEW_INTRO_KEY, day, true);
}

type Spaces = { study: boolean; personal: boolean };

/**
 * Tous les rappels visibles sont coupés ? Les rappels d'un espace désactivé sont en pause (ils
 * ne comptent pas) ; tâches, rendez-vous et bilan du soir existent dans tous les espaces.
 */
export function remindersPaused(prefs: NotificationPreferences, spaces: Spaces): boolean {
  const on: boolean[] = [prefs.tasks, prefs.events, prefs.eveningReview];
  if (spaces.study)
    on.push(prefs.courses, prefs.endOfCourse, prefs.assignments, prefs.exams, prefs.revisions);
  if (spaces.personal) on.push(prefs.habits, prefs.money);
  return !on.some(Boolean);
}

export type ReminderStatusView =
  | { kind: 'denied' }
  | { kind: 'undetermined' }
  | { kind: 'paused' }
  | { kind: 'pending' }
  | { kind: 'none' }
  | { kind: 'active'; count: number; until: Date };

/**
 * Ce que dit la ligne d'état des rappels. Une permission refusée passe avant tout (rien ne
 * sonnera) ; puis les rappels tous coupés ; puis le dernier passage du planificateur.
 */
export function reminderStatusView(input: {
  permission: 'granted' | 'undetermined' | 'denied' | null;
  paused: boolean;
  status: ReminderRunStatus | null;
}): ReminderStatusView | null {
  if (input.permission === null) return null;
  if (input.permission === 'denied') return { kind: 'denied' };
  if (input.permission === 'undetermined') return { kind: 'undetermined' };
  if (input.paused) return { kind: 'paused' };
  if (!input.status) return { kind: 'pending' };
  if (input.status.count === 0 || !input.status.lastAt) return { kind: 'none' };
  return { kind: 'active', count: input.status.count, until: new Date(input.status.lastAt) };
}
