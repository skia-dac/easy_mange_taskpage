import { getAccountOwner, getSupabase, mergeDuplicateProfiles } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { isAppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

import { syncOnce, SyncStopped, type SyncReport } from './engine';
import { supabaseFileStore, syncFiles } from './files';
import { supabaseRemote } from './remote';
import { setSyncStatus } from './status';

/** Reprise après un échec : 30 s, puis le double à chaque échec, jusqu'à 5 min. */
export const RETRY_START_MS = 30_000;
export const RETRY_MAX_MS = 5 * 60 * 1000;

let running: Promise<SyncReport | null> | null = null;
let runningUser: string | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_START_MS;
let scheduledDelay: number | null = null;
/** Nombre d'opérations en cours pendant lesquelles aucune synchronisation ne doit écrire. */
let pauses = 0;

/**
 * Exécute `job` sans synchronisation : celle qui tourne s'arrête avant sa prochaine écriture et on
 * attend qu'elle ait fini ; aucune ne démarre avant la fin de `job`. À utiliser pour tout ce qui
 * vide ou remplace la base (effacement, déconnexion, suppression du compte, restauration) : sinon
 * une réception en cours pourrait réécrire les données d'un compte après l'effacement.
 */
export async function withSyncPaused<T>(job: () => Promise<T>): Promise<T> {
  pauses++;
  cancelSyncRetry();
  try {
    if (running) await running;
    return await job();
  } finally {
    pauses--;
  }
}

function clearRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  scheduledDelay = null;
}

/** Annule la reprise programmée et remet le délai à zéro (réussite, déconnexion, changement de compte). */
export function cancelSyncRetry(): void {
  clearRetry();
  retryDelay = RETRY_START_MS;
}

/** Délai de la reprise automatique programmée, ou null s'il n'y en a pas. Pour les tests. */
export function pendingRetryDelay(): number | null {
  return scheduledDelay;
}

function scheduleRetry(db: Db, userId: string): void {
  clearRetry();
  scheduledDelay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    scheduledDelay = null;
    void start(db, userId, true);
  }, scheduledDelay);
}

/**
 * Lance une synchronisation (une seule à la fois). Ne lève jamais : l'état dit ce qui s'est passé.
 * Après un échec (hors ligne, erreur), une reprise est programmée avec un délai croissant ;
 * elle est annulée dès qu'un run réussit ou qu'un nouveau déclenchement arrive (qui repart de 30 s).
 * Un run demandé pour un autre compte pendant qu'un run tourne est refusé (jamais deux comptes mêlés).
 */
export function runSync(db: Db, userId: string): Promise<SyncReport | null> {
  return start(db, userId, false);
}

function start(db: Db, userId: string, fromRetry: boolean): Promise<SyncReport | null> {
  if (pauses > 0) return Promise.resolve(null);
  if (running) return runningUser === userId ? running : Promise.resolve(null);
  if (fromRetry) clearRetry();
  else cancelSyncRetry();
  const client = getSupabase();
  if (!client) return Promise.resolve(null);
  runningUser = userId;
  running = (async () => {
    setSyncStatus({ state: 'syncing' });
    try {
      const remote = supabaseRemote(client);
      // Avant chaque écriture : pause demandée, ou ce téléphone n'est plus relié à ce compte
      // (effacé, autre compte) → on s'arrête, jamais deux comptes mêlés.
      const shouldStop = async () => pauses > 0 || (await getAccountOwner(db)) !== userId;
      const stopIfAsked = async () => {
        if (await shouldStop()) throw new SyncStopped();
      };
      let report = await syncOnce(db, remote, { shouldStop });
      // Le pull vient de ramener le profil du compte : s'il double un profil créé hors ligne,
      // on fusionne tout de suite et on renvoie le résultat sans attendre la prochaine synchro.
      await stopIfAsked();
      if (await mergeDuplicateProfiles(db)) report = await syncOnce(db, remote, { shouldStop });
      await stopIfAsked();
      await syncFiles(db, userId, supabaseFileStore(client));
      cancelSyncRetry();
      setSyncStatus({ state: 'idle', lastError: null });
      return report;
    } catch (e) {
      if (e instanceof SyncStopped) {
        // Arrêt voulu : ni erreur affichée ni reprise programmée.
        setSyncStatus({ state: 'idle' });
        return null;
      }
      const offline = isAppError(e) && e.code === 'network';
      if (!offline) logger.error(e, { where: 'runSync' });
      setSyncStatus({
        state: offline ? 'offline' : 'error',
        lastError: offline ? 'errors.network' : 'sync.error',
      });
      scheduleRetry(db, userId);
      return null;
    } finally {
      running = null;
      runningUser = null;
    }
  })();
  return running;
}
