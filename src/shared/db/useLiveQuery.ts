import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState, type DependencyList } from 'react';

import { logger } from '../logger';
import { showError } from '../ui/dialogs';
import { subscribeToChanges } from './changes';
import { asDb } from './compat';
import type { Db } from './types';

export type LiveQuery<T> = { data: T | undefined; error: unknown; loading: boolean };

/** Un seul message pour plusieurs lectures en échec rapprochées (un écran en lance plusieurs). */
const LOAD_ERROR_QUIET_MS = 5000;
let lastLoadErrorAt = 0;
function notifyLoadError(): void {
  const now = Date.now();
  if (now - lastLoadErrorAt < LOAD_ERROR_QUIET_MS) return;
  lastLoadErrorAt = now;
  showError('errors.loadFailed');
}

/**
 * Lit des données et les recharge automatiquement quand une des tables indiquées change.
 * @param tables tables lues par la requête
 * @param deps valeurs dont dépend la requête (ex. l'id affiché)
 */
export function useLiveQuery<T>(
  query: (db: Db) => Promise<T>,
  tables: readonly string[],
  deps: DependencyList,
): LiveQuery<T> {
  const db = asDb(useSQLiteContext());
  const [state, setState] = useState<LiveQuery<T>>({ data: undefined, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const tablesKey = tables.join(',');

  useEffect(() => {
    const watched = new Set(tablesKey.split(','));
    return subscribeToChanges((changed) => {
      for (const t of changed) {
        if (watched.has(t)) {
          setVersion((v) => v + 1);
          return;
        }
      }
    });
  }, [tablesKey]);

  useEffect(() => {
    let active = true;
    query(db).then(
      (data) => active && setState({ data, error: null, loading: false }),
      (error: unknown) => {
        logger.error(error, { where: 'useLiveQuery' });
        if (!active) return;
        setState((s) => ({ ...s, error, loading: false }));
        notifyLoadError();
      },
    );
    return () => {
      active = false;
    };
    // `query` change à chaque rendu : on relance seulement si deps ou les données changent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, ...deps]);

  return state;
}

/** Accès direct à la base pour les écritures (use cases). */
export function useDb(): Db {
  return asDb(useSQLiteContext());
}
