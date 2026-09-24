import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { getSupabase, signOut } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { confirmDestructive } from '@/shared/ui';
import { claimLocalData, replaceLocalDataWithAccount } from '@/workflows';

/**
 * Après une connexion réussie : relie les données du téléphone au compte.
 * Si le téléphone contient les données d'un AUTRE compte, on demande avant de les effacer.
 */
export function useAfterSignIn() {
  const { t } = useTranslation();
  const db = useDb();
  return async () => {
    const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
    const userId = data.session?.user.id;
    if (!userId) return;
    if ((await claimLocalData(db, userId)) === 'otherAccount') {
      const ok = await confirmDestructive(
        t('account.otherTitle'),
        t('account.otherMessage'),
        t('account.otherConfirm'),
      );
      if (!ok) {
        await signOut();
        return;
      }
      await replaceLocalDataWithAccount(db, userId);
    }
    router.dismissTo('/account');
  };
}
