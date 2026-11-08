import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { signOut, useAuth } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { confirmDestructive, confirmDestructiveOrRetry } from '@/shared/ui';
import { pushBeforeErase, signOutFromPhone, wipeAllData } from '@/workflows';

/**
 * Effacer ce téléphone, mêmes étapes et mêmes textes partout (Réglages › « Supprimer toutes mes
 * données », Compte › « Se déconnecter › Effacer ce téléphone ») :
 *
 * 1. une confirmation, qui dit ce qui sera effacé (connecté : on est aussi déconnecté, le compte
 *    garde tout) ;
 * 2. connecté : on envoie ce qui attend ; s'il reste des modifications non envoyées, on le dit avec
 *    leur nombre (réessayer, effacer quand même, annuler) ;
 * 3. on efface, puis on revient au premier lancement.
 *
 * Résout `true` si le téléphone a été effacé. Les erreurs remontent à l'appelant (message
 * `accountMessageKey`).
 */
export function useErasePhone() {
  const { t } = useTranslation();
  const db = useDb();
  const { userId } = useAuth();

  return useCallback(async (): Promise<boolean> => {
    const ok = await confirmDestructive(
      t(userId ? 'account.eraseTitle' : 'data.wipeTitle'),
      t(userId ? 'account.eraseMessage' : 'data.wipeMessage'),
      t(userId ? 'account.eraseConfirm' : 'data.wipeConfirm'),
    );
    if (!ok) return false;
    if (userId) {
      let discardUnsynced = false;
      for (;;) {
        const left = await pushBeforeErase(db, userId);
        if (left === 0) break;
        const choice = await confirmDestructiveOrRetry(
          t('account.unsyncedTitle'),
          t('account.unsyncedMessage', { count: left }),
          t('account.unsyncedRetry'),
          t('account.unsyncedErase'),
        );
        if (choice === 'cancel') return false;
        if (choice === 'destructive') {
          discardUnsynced = true;
          break;
        }
      }
      // Refuse encore d'effacer des modifications non envoyées sans « Effacer quand même ».
      await signOutFromPhone(db, false, { discardUnsynced });
    } else {
      await wipeAllData(db);
      // Des données peuvent rester sur un compte : on se déconnecte pour ne pas les recevoir de
      // nouveau (sans condition : une session peut exister sans que l'état d'auth soit renseigné).
      await signOut();
    }
    router.replace('/onboarding');
    return true;
  }, [db, t, userId]);
}
