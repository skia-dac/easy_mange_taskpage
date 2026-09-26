import * as BackgroundTask from 'expo-background-task';
import { openDatabaseAsync } from 'expo-sqlite';
import * as TaskManager from 'expo-task-manager';

import { loadAgenda } from '@/projections';
import { DATABASE_NAME, setupDatabase } from '@/shared/db';
import { logger } from '@/shared/logger';

import { syncScheduledNotifications } from './scheduler';

/**
 * Tâche de fond quotidienne : reprogramme les rappels sans que l'app soit ouverte.
 * Le quota de 60 notifications programmées s'épuise en quelques jours ; sans cette tâche, un
 * étudiant qui n'ouvre pas l'app une semaine n'a plus de rappels.
 */
export const NOTIFICATIONS_TASK = 'mysky-notifications-refresh';
/** Intervalle minimal demandé au système (en minutes) : une fois par jour. */
export const NOTIFICATIONS_TASK_INTERVAL_MINUTES = 24 * 60;

/** Corps de la tâche : ouvre la base, recharge l'agenda et reprogramme les rappels. */
export async function refreshNotificationsInBackground(now = new Date()): Promise<number> {
  const db = await openDatabaseAsync(DATABASE_NAME);
  try {
    await setupDatabase(db);
    const data = await loadAgenda(db);
    return await syncScheduledNotifications(db, data, now);
  } finally {
    await db.closeAsync();
  }
}

/** À appeler une fois, hors composant : définit la tâche auprès du gestionnaire de tâches. */
export function defineNotificationsTask(): void {
  try {
    if (TaskManager.isTaskDefined(NOTIFICATIONS_TASK)) return;
    TaskManager.defineTask(NOTIFICATIONS_TASK, async () => {
      try {
        await refreshNotificationsInBackground();
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch (e) {
        logger.error(e, { where: 'notificationsBackgroundTask' });
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch (e) {
    // Sans le module natif (Expo Go ancien, web), la définition échoue : l'app reste utilisable.
    logger.error(e, { where: 'defineNotificationsTask' });
  }
}

/** Enregistre la tâche auprès du système (sans effet si déjà enregistrée ou indisponible). */
export async function registerNotificationsTask(): Promise<boolean> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (await TaskManager.isTaskRegisteredAsync(NOTIFICATIONS_TASK)) return true;
    await BackgroundTask.registerTaskAsync(NOTIFICATIONS_TASK, {
      minimumInterval: NOTIFICATIONS_TASK_INTERVAL_MINUTES,
    });
    return true;
  } catch (e) {
    logger.error(e, { where: 'registerNotificationsTask' });
    return false;
  }
}
