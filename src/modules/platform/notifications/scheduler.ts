import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { listSubjects } from '@/modules/academic';
import { getNotificationPreferences } from '@/modules/identity';
import type { TodayData } from '@/projections';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { planReminders, type PlannedReminder, type ReminderAction } from './plan';

export const END_OF_COURSE_CATEGORY = 'endofcourse';
export const ACTIONS = {
  addAssignment: 'add_assignment',
  addTask: 'add_task',
  nothing: 'nothing',
} as const;

let configured = false;

/** À appeler une fois au démarrage : comportement quand l'app est ouverte, et boutons de fin de cours. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: i18n.t('notif.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync(END_OF_COURSE_CATEGORY, [
    {
      identifier: ACTIONS.addAssignment,
      buttonTitle: i18n.t('notif.actionAssignment'),
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

export async function hasPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Remplace toutes les notifications programmées par le plan actuel.
 * Appelé à chaque changement de données (architecture §9.2) : un cours déplacé ou annulé
 * recalcule ses rappels ; un devoir terminé perd le sien.
 */
export async function syncScheduledNotifications(
  db: Db,
  data: TodayData,
  now = new Date(),
): Promise<number> {
  if (!(await hasPermission())) return 0;
  const [prefs, subjects] = await Promise.all([getNotificationPreferences(db), listSubjects(db)]);
  const byId = new Map(subjects.map((s) => [s.id, s.name]));
  const plan = planReminders(data, prefs, now, { subjectName: (id) => byId.get(id) ?? '' });
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Promise.all(plan.map(scheduleOne));
  return plan.length;
}

async function scheduleOne(r: PlannedReminder): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: i18n.t(r.title.key, r.title.params),
        body: i18n.t(r.body.key, r.body.params),
        data: r.action,
        categoryIdentifier: r.category === 'endOfCourse' ? END_OF_COURSE_CATEGORY : undefined,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.fireAt,
        channelId: Platform.OS === 'android' ? 'reminders' : undefined,
      },
    });
  } catch (e) {
    logger.error(e, { where: 'scheduleOne', id: r.id });
  }
}

export type NotificationResponse = { actionIdentifier: string; action: ReminderAction };

/** Lit la réponse à une notification (touchée ou bouton), avec ses données vérifiées. */
export function readResponse(
  response: Notifications.NotificationResponse | null | undefined,
): NotificationResponse | null {
  if (!response) return null;
  const data = response.notification.request.content.data as Partial<ReminderAction> | undefined;
  if (!data || typeof data.kind !== 'string') return null;
  return { actionIdentifier: response.actionIdentifier, action: data as ReminderAction };
}

export const addResponseListener = Notifications.addNotificationResponseReceivedListener;
export const getLastResponse = Notifications.getLastNotificationResponseAsync;
export const clearLastResponse = Notifications.clearLastNotificationResponseAsync;
