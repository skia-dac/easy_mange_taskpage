import { getSupabase } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { isAppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

import { syncOnce, type SyncReport } from './engine';
import { supabaseFileStore, syncFiles } from './files';
import { supabaseRemote } from './remote';
import { setSyncStatus } from './status';

let running: Promise<SyncReport | null> | null = null;

/** Lance une synchronisation (une seule à la fois). Ne lève jamais : l'état dit ce qui s'est passé. */
export function runSync(db: Db, userId: string): Promise<SyncReport | null> {
  if (running) return running;
  const client = getSupabase();
  if (!client) return Promise.resolve(null);
  running = (async () => {
    setSyncStatus({ state: 'syncing' });
    try {
      const report = await syncOnce(db, supabaseRemote(client));
      await syncFiles(db, userId, supabaseFileStore(client));
      setSyncStatus({ state: 'idle', lastError: null });
      return report;
    } catch (e) {
      const offline = isAppError(e) && e.code === 'network';
      if (!offline) logger.error(e, { where: 'runSync' });
      setSyncStatus({
        state: offline ? 'offline' : 'error',
        lastError: offline ? 'errors.network' : 'sync.error',
      });
      return null;
    } finally {
      running = null;
    }
  })();
  return running;
}
