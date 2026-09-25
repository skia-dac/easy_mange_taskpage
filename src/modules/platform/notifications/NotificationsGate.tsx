import { useNotifications } from './useNotifications';

/** Composant sans affichage : active les notifications une fois la base prête. */
export function NotificationsGate() {
  useNotifications();
  return null;
}
