import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { toIsoDate } from '../dates';
import { logger } from '../logger';
import { subscribeToChanges } from './changes';
import { asDb } from './compat';
import { notifyLoadError } from './loadErrors';
import type { Db } from './types';
import type { LiveQuery } from './useLiveQuery';

type Entry<T> = {
  query: (db: Db) => Promise<T>;
  tables: ReadonlySet<string>;
  state: LiveQuery<T>;
  listeners: Set<() => void>;
  unsubscribe: (() => void) | null;
  /** Numéro de la dernière lecture lancée (une réponse plus ancienne est ignorée). */
  run: number;
  /** Données à recharger au prochain abonné (des changements ont pu passer sans abonné). */
  stale: boolean;
  /** Moment de la dernière lecture lancée (retour au premier plan). */
  loadedAt: number;
  loadedDay: string;
};

export type SharedLiveQueryOptions = {
  /**
   * `foreground` : recharge aussi au retour de l'app au premier plan, si la dernière lecture date
   * de plus de FOREGROUND_REFRESH_MS ou si le jour a changé (les fenêtres « aujourd'hui » suivent).
   */
  refreshOn?: 'foreground';
};

/** Âge à partir duquel une lecture est refaite au retour de l'app. */
export const FOREGROUND_REFRESH_MS = 60_000;

const stores = new WeakMap<Db, Map<string, Entry<unknown>>>();

function entryFor<T>(
  db: Db,
  key: string,
  query: (db: Db) => Promise<T>,
  tables: readonly string[],
): Entry<T> {
  let store = stores.get(db);
  if (!store) {
    store = new Map();
    stores.set(db, store);
  }
  let entry = store.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = {
      query,
      tables: new Set(tables),
      state: { data: undefined, error: null, loading: true },
      listeners: new Set(),
      unsubscribe: null,
      run: 0,
      stale: true,
      loadedAt: 0,
      loadedDay: '',
    };
    store.set(key, entry as Entry<unknown>);
  }
  return entry;
}

function reload<T>(db: Db, entry: Entry<T>, now = new Date()): void {
  const run = ++entry.run;
  entry.stale = false;
  entry.loadedAt = now.getTime();
  entry.loadedDay = toIsoDate(now);
  entry.query(db).then(
    (data) => {
      if (run !== entry.run) return;
      entry.state = { data, error: null, loading: false };
      entry.listeners.forEach((l) => l());
    },
    (error: unknown) => {
      if (run !== entry.run) return;
      logger.error(error, { where: 'useSharedLiveQuery' });
      entry.state = { ...entry.state, error, loading: false };
      entry.listeners.forEach((l) => l());
      notifyLoadError();
    },
  );
}

/** Faut-il relire au retour au premier plan ? Lecture trop ancienne, ou jour changé. */
export function shouldRefreshOnForeground(
  loaded: { loadedAt: number; loadedDay: string },
  now: Date,
): boolean {
  return (
    now.getTime() - loaded.loadedAt >= FOREGROUND_REFRESH_MS || toIsoDate(now) !== loaded.loadedDay
  );
}

/**
 * Comme `useLiveQuery`, mais une seule lecture partagée par `key` (par base) quel que soit le
 * nombre d'écrans qui l'utilisent : l'agenda ou l'argent ne sont chargés qu'une fois, et rechargés
 * une fois par modification. Sans abonné, l'abonnement aux changements est relâché ; les données
 * restent en cache et sont rafraîchies au prochain abonné.
 */
export function useSharedLiveQuery<T>(
  key: string,
  query: (db: Db) => Promise<T>,
  tables: readonly string[],
  options: SharedLiveQueryOptions = {},
): LiveQuery<T> {
  const db = asDb(useSQLiteContext());
  const refreshOnForeground = options.refreshOn === 'foreground';
  const subscribe = useCallback(
    (onChange: () => void) => {
      const entry = entryFor(db, key, query, tables);
      entry.listeners.add(onChange);
      if (!entry.unsubscribe) {
        const unsubscribeChanges = subscribeToChanges((changed) => {
          for (const t of changed) {
            if (entry.tables.has(t)) {
              reload(db, entry);
              return;
            }
          }
        });
        const appState = refreshOnForeground
          ? AppState.addEventListener('change', (s) => {
              const now = new Date();
              if (s === 'active' && shouldRefreshOnForeground(entry, now)) reload(db, entry, now);
            })
          : null;
        entry.unsubscribe = () => {
          unsubscribeChanges();
          appState?.remove();
        };
      }
      if (entry.stale) reload(db, entry);
      return () => {
        entry.listeners.delete(onChange);
        if (entry.listeners.size === 0 && entry.unsubscribe) {
          entry.unsubscribe();
          entry.unsubscribe = null;
          entry.stale = true;
        }
      };
    },
    // `query` et `tables` sont fixes pour une `key` donnée.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, key, refreshOnForeground],
  );
  const getSnapshot = useCallback(
    () => entryFor(db, key, query, tables).state,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, key],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
