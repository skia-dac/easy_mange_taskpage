import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { getNotificationPromptSnoozedAt, setNotificationPromptSnoozedAt } from '@/modules/identity';
import {
  ensurePermission,
  notificationPermission,
  type NotificationPermission,
} from '@/modules/platform';
import { useDb, type Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { confirmAction } from '@/shared/ui';

/** Après « Plus tard », l'explication n'est pas reproposée d'elle-même pendant 7 jours. */
export const NOTIFICATION_PROMPT_SNOOZE_DAYS = 7;
const SNOOZE_MS = NOTIFICATION_PROMPT_SNOOZE_DAYS * 24 * 60 * 60 * 1000;

/** « Plus tard » répondu il y a moins de 7 jours ? */
export function isPromptSnoozed(snoozedAt: string | null, now: Date = new Date()): boolean {
  if (!snoozedAt) return false;
  const elapsed = now.getTime() - new Date(snoozedAt).getTime();
  // Une date dans le futur (horloge du téléphone changée) ne bloque pas indéfiniment.
  return elapsed >= 0 && elapsed < SNOOZE_MS;
}

export type AskOptions = {
  /**
   * L'utilisateur a touché lui-même « Autoriser les notifications » : on demande même après un
   * « Plus tard » récent. Sans `force` (rappel enregistré), on se tait pendant 7 jours.
   */
  force?: boolean;
  now?: Date;
};

/**
 * Demande la permission des notifications si elle n'est pas encore décidée : d'abord une courte
 * explication dans l'app (« Recevoir tes rappels ? »), puis la boîte du système. Déjà accordée
 * ou refusée : rien n'est demandé. « Plus tard » est retenu (`app_settings`) : l'explication
 * ne revient pas d'elle-même avant 7 jours, sauf si l'utilisateur touche « Autoriser ».
 * Résout l'état obtenu (`null` s'il est illisible).
 *
 * À appeler une fois le choix terminé (rappel enregistré : tâche, rendez-vous, examen, cours) et
 * depuis le bouton « Autoriser les notifications » (`force`).
 */
export async function askNotificationPermission(
  db: Db,
  { force = false, now = new Date() }: AskOptions = {},
): Promise<NotificationPermission | null> {
  try {
    const current = await notificationPermission();
    if (current !== 'undetermined') return current;
    if (!force && isPromptSnoozed(await getNotificationPromptSnoozedAt(db), now)) return current;
    const ok = await confirmAction(
      i18n.t('reminder.permissionTitle'),
      i18n.t('reminder.permissionMessage'),
      i18n.t('reminder.permissionContinue'),
      i18n.t('reminder.permissionLater'),
    );
    if (!ok) {
      await setNotificationPromptSnoozedAt(db, now.toISOString());
      return 'undetermined';
    }
    await setNotificationPromptSnoozedAt(db, null);
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
  const db = useDb();
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

  const ask = useCallback(
    async (options?: AskOptions) => {
      const next = await askNotificationPermission(db, options);
      if (next) setState(next);
      return next;
    },
    [db],
  );

  return { state, ask };
}
