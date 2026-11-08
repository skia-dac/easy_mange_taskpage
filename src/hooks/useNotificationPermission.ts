import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  ensurePermission,
  notificationPermission,
  type NotificationPermission,
} from '@/modules/platform';
import { i18n } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { confirmAction } from '@/shared/ui';

/**
 * Demande la permission des notifications si elle n'est pas encore décidée : d'abord une courte
 * explication dans l'app (« Recevoir tes rappels ? »), puis la boîte du système. Déjà accordée
 * ou refusée : rien n'est demandé. Résout l'état obtenu (`null` s'il est illisible).
 *
 * À appeler au moment où un rappel est choisi ou enregistré (tâche, examen, cours) et depuis le
 * bouton « Autoriser les notifications ».
 */
export async function askNotificationPermission(): Promise<NotificationPermission | null> {
  try {
    const current = await notificationPermission();
    if (current !== 'undetermined') return current;
    const ok = await confirmAction(
      i18n.t('reminder.permissionTitle'),
      i18n.t('reminder.permissionMessage'),
      i18n.t('reminder.permissionContinue'),
    );
    if (!ok) return 'undetermined';
    await ensurePermission();
    return await notificationPermission();
  } catch (e) {
    logger.error(e, { where: 'notificationPermission' });
    return null;
  }
}

/** Ouvre les réglages du téléphone (permission refusée : seul le système peut la rendre). */
export function openNotificationSettings(): void {
  void Promise.resolve(Linking.openSettings()).catch((e: unknown) =>
    logger.error(e, { where: 'openNotificationSettings' }),
  );
}

/**
 * État de la permission des notifications, relu au retour de l'app (l'utilisateur revient
 * peut-être des réglages du téléphone), et `ask()` pour la demander (voir
 * `askNotificationPermission`). `null` tant que l'état n'est pas connu ou si `active` est faux.
 */
export function useNotificationPermission(active = true) {
  const [state, setState] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const refresh = () =>
      notificationPermission().then(
        (p) => alive && setState(p),
        (e: unknown) => logger.error(e, { where: 'notificationPermission' }),
      );
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [active]);

  const ask = useCallback(async () => {
    const next = await askNotificationPermission();
    if (next) setState(next);
    return next;
  }, []);

  return { state, ask };
}
