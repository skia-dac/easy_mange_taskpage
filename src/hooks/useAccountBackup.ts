import { useCallback } from 'react';

import { getAccountOwner, getLastSyncAt, useAuth } from '@/modules/identity';
import {
  COUNTED_TABLES,
  countUserItems,
  getAccountReminderSnoozedAt,
  pendingCount,
  setAccountReminderSnoozedAt,
  shouldShowAccountReminder,
  useSyncStatus,
} from '@/modules/platform';
import { useDb, useLiveQuery, type Db } from '@/shared/db';
import { useNow } from '@/shared/useNow';
import { backupNow, type BackupNowResult } from '@/workflows';

/**
 * Où sont les données de l'utilisateur ?
 * - `unavailable` : cette version n'a pas de serveur (comptes indisponibles) ;
 * - `signedOut` : pas de compte, tout est seulement sur ce téléphone ;
 * - `account` : connecté, les données de ce téléphone sont sauvegardées sur le compte ;
 * - `otherAccount` : connecté, mais ce téléphone contient les données d'un autre compte (rien n'est
 *   envoyé tant que ce n'est pas réglé dans « Compte et synchronisation ») ;
 * - `loading` : la session ou les réglages sont encore en lecture.
 */
export type AccountBackupMode =
  'loading' | 'unavailable' | 'signedOut' | 'account' | 'otherAccount';

export function accountBackupMode(input: {
  enabled: boolean;
  authLoading: boolean;
  userId: string | null;
  /** Propriétaire des données du téléphone ; `undefined` tant qu'il n'est pas lu. */
  owner: string | null | undefined;
}): AccountBackupMode {
  if (!input.enabled) return 'unavailable';
  if (input.authLoading) return 'loading';
  if (!input.userId) return 'signedOut';
  if (input.owner === undefined) return 'loading';
  // Propriétaire pas encore enregistré : AccountGate relie tout de suite ce téléphone au compte.
  return input.owner && input.owner !== input.userId ? 'otherAccount' : 'account';
}

type Info = {
  owner: string | null;
  lastSyncAt: string | null;
  pending: number;
  items: number;
  snoozedAt: string | null;
};

async function readInfo(db: Db): Promise<Info> {
  return {
    owner: await getAccountOwner(db),
    lastSyncAt: await getLastSyncAt(db),
    pending: await pendingCount(db),
    items: await countUserItems(db),
    snoozedAt: await getAccountReminderSnoozedAt(db),
  };
}

/**
 * État de la sauvegarde des données (Réglages › Mes données, carte d'Aujourd'hui).
 * Avec un compte, la sauvegarde EST la synchronisation : `saveNow` la lance tout de suite.
 */
export function useAccountBackup() {
  const db = useDb();
  const { enabled, loading: authLoading, userId } = useAuth();
  const sync = useSyncStatus();
  const now = useNow(60_000);
  const info = useLiveQuery(
    readInfo,
    ['app_settings', 'sync_outbox', ...COUNTED_TABLES],
    // La date de dernière synchro est écrite sans notification : on relit à chaque fin de synchro.
    [sync.state],
  );
  const data = info.data;
  const mode = accountBackupMode({ enabled, authLoading, userId, owner: data?.owner });

  const saveNow = useCallback(
    async (): Promise<BackupNowResult> =>
      userId ? backupNow(db, userId) : { kind: 'error' as const },
    [db, userId],
  );
  const snooze = useCallback(() => setAccountReminderSnoozedAt(db, new Date().toISOString()), [db]);

  return {
    mode,
    lastSyncAt: data?.lastSyncAt ?? null,
    pending: data?.pending ?? 0,
    syncing: sync.state === 'syncing',
    showReminder:
      !!data &&
      shouldShowAccountReminder({
        accountsEnabled: enabled,
        authLoading,
        signedIn: !!userId,
        itemCount: data.items,
        snoozedAt: data.snoozedAt,
        now,
      }),
    saveNow,
    snooze,
  };
}
