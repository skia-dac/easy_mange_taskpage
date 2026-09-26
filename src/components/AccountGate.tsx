import { useEffect } from 'react';

import { getAccountOwner, useAuth } from '@/modules/identity';
import { SyncGate } from '@/modules/platform';
import { useDb, useLiveQuery } from '@/shared/db';
import { logger } from '@/shared/logger';
import { claimLocalData } from '@/workflows';

/**
 * Relie ce téléphone au compte connecté (données sans propriétaire), puis active la synchronisation
 * automatique — seulement si les données du téléphone appartiennent bien à ce compte.
 */
export function AccountGate() {
  const db = useDb();
  const { userId } = useAuth();
  const owner = useLiveQuery((d) => getAccountOwner(d), ['app_settings'], []);

  useEffect(() => {
    // En cas d'échec, la synchro reste désactivée (`ready` faux) : rien n'est envoyé au mauvais compte.
    if (userId && !owner.loading && owner.data === null)
      claimLocalData(db, userId).catch((e: unknown) => logger.error(e, { where: 'AccountGate' }));
  }, [db, userId, owner.loading, owner.data]);

  return <SyncGate ready={!!userId && owner.data === userId} />;
}
