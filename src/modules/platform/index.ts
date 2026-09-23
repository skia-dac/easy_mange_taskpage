// Module platform : notifications (fichiers, import, synchronisation, recherche : phases suivantes).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export { HORIZON_DAYS, MAX_SCHEDULED, planReminders } from './notifications/plan';
export type { PlannedReminder, ReminderAction } from './notifications/plan';
export { routeForResponse } from './notifications/route';
export {
  ensurePermission,
  hasPermission,
  syncScheduledNotifications,
} from './notifications/scheduler';
export { NotificationsGate } from './notifications/NotificationsGate';
export { useNotifications } from './notifications/useNotifications';
