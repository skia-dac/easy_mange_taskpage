import { conflictCount } from '@/modules/platform';
import { useLiveQuery } from '@/shared/db';

/**
 * Conflits de synchronisation encore à régler, `undefined` tant que la lecture n'a pas répondu.
 * Relu à chaque synchronisation et à chaque conflit réglé (`sync_conflicts` est annoncé).
 */
export function useConflictCount(): number | undefined {
  return useLiveQuery(conflictCount, ['sync_conflicts'], []).data;
}
