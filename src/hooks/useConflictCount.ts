import { conflictCount, conflictIds } from '@/modules/platform';
import { useLiveQuery } from '@/shared/db';

/**
 * Conflits de synchronisation encore à régler, `undefined` tant que la lecture n'a pas répondu.
 * Relu à chaque synchronisation et à chaque conflit réglé (`sync_conflicts` est annoncé).
 */
export function useConflictCount(): number | undefined {
  return useLiveQuery(conflictCount, ['sync_conflicts'], []).data;
}

/**
 * Ids des conflits encore à régler, `undefined` tant que la lecture n'a pas répondu. Un conflit
 * réglé et un nouveau dans la même synchronisation gardent le même nombre : les ids, eux, changent.
 */
export function useConflictIds(): readonly string[] | undefined {
  return useLiveQuery(conflictIds, ['sync_conflicts'], []).data;
}
