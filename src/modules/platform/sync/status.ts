import { useSyncExternalStore } from 'react';

/** État de la synchronisation affiché dans l'app (en mémoire ; la date de dernière synchro est en base). */
export type SyncStatus = {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  lastError: string | null;
};

let status: SyncStatus = { state: 'idle', lastError: null };
const listeners = new Set<() => void>();

export function setSyncStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => status,
  );
}
