import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { listSubjects } from '@/modules/academic';
import { getMoneyPrefs } from '@/modules/finance';
import { getNotificationPreferences, type NotificationPreferences } from '@/modules/identity';
import type { TodayData } from '@/projections';
import { isIsoDate } from '@/shared/dates';
import type { Db } from '@/shared/db';
import { formatShortDate } from '@/shared/format';
import { i18n } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import {
  planReminders,
  reminderActionSchema,
  type PlannedReminder,
  type ReminderAction,
} from './plan';

export const END_OF_COURSE_CATEGORY = 'endofcourse';
export const ACTIONS = {
  /** Ancien bouton « Ajouter un devoir » : plus proposé, gardé pour les notifications déjà reçues. */
  addAssignment: 'add_assignment',
  addNote: 'add_note',
  addTask: 'add_task',
  nothing: 'nothing',
} as const;

let configured = false;

/**
 * Canaux Android : un canal ne peut plus être modifié une fois créé (c'est le système qui décide),
 * on en crée donc un par combinaison son / vibration et on choisit le bon à chaque rappel.
 * Version 2 : contenu masqué sur l'écran verrouillé (titres de tâches, montants). Les canaux de la
 * version 1 (sans ce réglage, qu'on ne peut plus changer) sont supprimés.
 */
const CHANNELS = {
  full: 'reminders-v2',
  silent: 'reminders-silent-v2',
  noVibration: 'reminders-novibration-v2',
  quiet: 'reminders-quiet-v2',
} as const;

const OLD_CHANNELS = [
  'reminders',
  'reminders-silent',
  'reminders-novibration',
  'reminders-quiet',
] as const;

export function channelFor(prefs: Pick<NotificationPreferences, 'sound' | 'vibrate'>): string {
  if (prefs.sound && prefs.vibrate) return CHANNELS.full;
  if (prefs.sound) return CHANNELS.noVibration;
  if (prefs.vibrate) return CHANNELS.silent;
  return CHANNELS.quiet;
}

async function createChannels(): Promise<void> {
  const name = i18n.t('notif.channel');
  const importance = Notifications.AndroidImportance.HIGH;
  // Écran verrouillé : « contenu masqué » tant que le téléphone n'est pas déverrouillé.
  const lockscreenVisibility = Notifications.AndroidNotificationVisibility.PRIVATE;
  await Promise.all(
    OLD_CHANNELS.map((id) => Notifications.deleteNotificationChannelAsync(id).catch(() => null)),
  );
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.full, {
      name,
      importance,
      lockscreenVisibility,
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.noVibration, {
      name: `${name} · ${i18n.t('settings.noVibration')}`,
      importance,
      lockscreenVisibility,
      enableVibrate: false,
      vibrationPattern: [0],
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.silent, {
      name: `${name} · ${i18n.t('settings.noSound')}`,
      importance,
      lockscreenVisibility,
      sound: null,
      enableVibrate: true,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.quiet, {
      name: `${name} · ${i18n.t('settings.quiet')}`,
      importance,
      lockscreenVisibility,
      sound: null,
      enableVibrate: false,
      vibrationPattern: [0],
    }),
  ]);
}

/** À appeler une fois au démarrage : comportement quand l'app est ouverte, et boutons de fin de cours. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: notification.request.content.sound !== null,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') await createChannels();
  await Notifications.setNotificationCategoryAsync(END_OF_COURSE_CATEGORY, [
    {
      identifier: ACTIONS.addNote,
      buttonTitle: i18n.t('notif.actionNote'),
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTIONS.addTask,
      buttonTitle: i18n.t('notif.actionTask'),
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTIONS.nothing,
      buttonTitle: i18n.t('notif.actionNothing'),
      options: { opensAppToForeground: false },
    },
  ]);
}

/** Demande la permission si elle n'a jamais été demandée. Retourne true si accordée. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * État de la permission, pour l'expliquer au bon moment : `undetermined` = on peut encore
 * demander (après une courte explication) ; `denied` = seul le réglage du téléphone peut la rendre.
 */
export type NotificationPermission = 'granted' | 'undetermined' | 'denied';

export async function notificationPermission(): Promise<NotificationPermission> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

export async function hasPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Empreinte stable de ce qui serait programmé : chaque rappel (id, heure, textes, catégorie), le
 * son et la vibration (canal Android) et la langue des textes. Deux plans de même empreinte
 * donnent exactement les mêmes notifications.
 */
export function planKey(
  plan: readonly PlannedReminder[],
  prefs: Pick<NotificationPreferences, 'sound' | 'vibrate'>,
  language: string,
): string {
  return JSON.stringify([
    language,
    prefs.sound,
    prefs.vibrate,
    plan.map((r) => [r.id, r.fireAt.getTime(), r.title, r.body, r.action, r.category ?? null]),
  ]);
}

/** Empreinte du dernier plan programmé (null : rien de connu, on reprogramme). */
let scheduledKey: string | null = null;

/**
 * File des opérations sur les notifications programmées : une seule à la fois. Sans elle, deux
 * reprogrammations se chevauchent (A annule, B annule, puis les rappels de A arrivent après
 * l'annulation de B) : un rappel fantôme survit, et l'empreinte le cache ensuite.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(op: () => Promise<T>): Promise<T> {
  const result = queue.then(op, op);
  queue = result.catch(() => undefined);
  return result;
}

type SyncArgs = { db: Db; data: TodayData; now: Date | undefined };
/** Reprogrammation en attente (pas encore commencée) : un nouvel appel remplace son plan. */
let pendingSync: { args: SyncArgs; result: Promise<number> } | null = null;

/** Oublie le dernier plan (tests, ou notifications effacées par ailleurs). */
export function resetScheduledPlan(): void {
  scheduledKey = null;
}

/**
 * Remplace toutes les notifications programmées par le plan actuel, **seulement s'il a changé**.
 * Appelé à chaque changement de données (architecture §9.2) : un cours déplacé ou annulé
 * recalcule ses rappels ; un devoir terminé perd le sien. Une dépense ou une humeur, qui ne
 * changent aucun rappel, ne font rien annuler ni reprogrammer. Retourne le nombre de rappels du
 * plan.
 *
 * Les passages se suivent, jamais en même temps. Les appels faits pendant un passage sont
 * regroupés : un seul passage suit, avec le plan le plus récent (le dernier appel gagne).
 */
export function syncScheduledNotifications(db: Db, data: TodayData, now?: Date): Promise<number> {
  const args: SyncArgs = { db, data, now };
  if (pendingSync) {
    pendingSync.args = args;
    return pendingSync.result;
  }
  const entry = { args } as { args: SyncArgs; result: Promise<number> };
  entry.result = enqueue(() => {
    // Le passage commence : les appels suivants attendront le prochain.
    if (pendingSync === entry) pendingSync = null;
    return runSync(entry.args);
  });
  pendingSync = entry;
  return entry.result;
}

async function runSync({ db, data, now = new Date() }: SyncArgs): Promise<number> {
  if (!(await hasPermission())) {
    // Permission retirée : au retour, tout est reprogrammé.
    scheduledKey = null;
    return 0;
  }
  const [prefs, subjects, money] = await Promise.all([
    getNotificationPreferences(db),
    listSubjects(db),
    getMoneyPrefs(db),
  ]);
  const byId = new Map(subjects.map((s) => [s.id, s.name]));
  const plan = planReminders(data, prefs, now, {
    subjectName: (id) => byId.get(id) ?? '',
    hideAmounts: money.hideWidgetAmounts,
  });
  const key = planKey(plan, prefs, i18n.language);
  if (key === scheduledKey) return plan.length;
  // Une programmation interrompue (erreur, rappel refusé) doit être refaite au prochain appel :
  // l'empreinte n'est posée qu'une fois tout le plan programmé.
  scheduledKey = null;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const scheduled = await Promise.all(plan.map((r) => scheduleOne(r, prefs)));
  if (scheduled.every(Boolean)) scheduledKey = key;
  return plan.length;
}

/** Annule tous les rappels programmés (suppression des données), après le passage en cours. */
export function cancelAllReminders(): Promise<void> {
  return enqueue(async () => {
    scheduledKey = null;
    await Notifications.cancelAllScheduledNotificationsAsync();
  });
}

/** Les dates « AAAA-MM-JJ » des textes deviennent « mer. 1 oct. » dans la langue du téléphone. */
export function readableParams(params: Record<string, string | number> | undefined) {
  if (!params) return params;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params))
    out[k] = typeof v === 'string' && isIsoDate(v) ? formatShortDate(v, i18n.language) : v;
  return out;
}

/** Programme un rappel ; false s'il est refusé (le plan sera refait au prochain passage). */
async function scheduleOne(r: PlannedReminder, prefs: NotificationPreferences): Promise<boolean> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: i18n.t(r.title.key, readableParams(r.title.params)),
        body: i18n.t(r.body.key, readableParams(r.body.params)),
        data: r.action,
        categoryIdentifier: r.category === 'endOfCourse' ? END_OF_COURSE_CATEGORY : undefined,
        sound: prefs.sound,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.fireAt,
        channelId: Platform.OS === 'android' ? channelFor(prefs) : undefined,
      },
    });
    return true;
  } catch (e) {
    logger.error(e, { where: 'scheduleOne', id: r.id });
    return false;
  }
}

export type NotificationResponse = { actionIdentifier: string; action: ReminderAction };

/** Lit la réponse à une notification (touchée ou bouton), avec ses données vérifiées. */
export function readResponse(
  response: Notifications.NotificationResponse | null | undefined,
): NotificationResponse | null {
  if (!response) return null;
  const parsed = reminderActionSchema.safeParse(response.notification.request.content.data);
  if (!parsed.success) {
    logger.warn('Notification ignorée : données inconnues');
    return null;
  }
  return { actionIdentifier: response.actionIdentifier, action: parsed.data };
}

export const addResponseListener = Notifications.addNotificationResponseReceivedListener;
export const getLastResponse = Notifications.getLastNotificationResponseAsync;
export const clearLastResponse = Notifications.clearLastNotificationResponseAsync;
