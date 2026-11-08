import { getLastSyncAt } from '@/modules/identity';
import {
  getSyncStatus,
  pendingCount,
  runSync,
  type SyncReport,
  type SyncStatus,
} from '@/modules/platform';
import { nowIso, type Db } from '@/shared/db';

import { claimLocalData } from './account';

export type BackupNowResult =
  /** Envoi puis réception faits : `pending` = ce qui reste en file (refusé, nouvelle modification). */
  | { kind: 'saved'; at: string; pending: number }
  /** Pas de réseau : la synchronisation automatique reprendra seule dès la connexion. */
  | { kind: 'offline' }
  /** Ce téléphone contient les données d'un autre compte : rien n'est envoyé (jamais mêlé). */
  | { kind: 'otherAccount' }
  | { kind: 'error' };

export type BackupNowDeps = {
  run: (db: Db, userId: string) => Promise<SyncReport | null>;
  status: () => SyncStatus;
};

const defaultDeps: BackupNowDeps = { run: runSync, status: getSyncStatus };

/**
 * « Sauvegarder maintenant » (Réglages › Mes données, avec un compte) : c'est la synchronisation
 * habituelle (`runSync`), lancée tout de suite. Elle envoie la file `sync_outbox` au serveur
 * (`mysky_push`), reçoit les changements des autres appareils, puis envoie les pièces jointes et
 * la photo de profil (bucket privé). `runSync` ne lève jamais : on lit son état pour le résultat.
 * Si une synchronisation tourne déjà pour ce compte, on attend la sienne.
 */
export async function backupNow(
  db: Db,
  userId: string,
  deps: BackupNowDeps = defaultDeps,
): Promise<BackupNowResult> {
  // Données pas encore reliées au compte : on les relie d'abord (comme AccountGate).
  if ((await claimLocalData(db, userId)) === 'otherAccount') return { kind: 'otherAccount' };
  const report = await deps.run(db, userId);
  if (report) {
    return {
      kind: 'saved',
      at: (await getLastSyncAt(db)) ?? nowIso(),
      pending: await pendingCount(db),
    };
  }
  return deps.status().state === 'offline' ? { kind: 'offline' } : { kind: 'error' };
}
