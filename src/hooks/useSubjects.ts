import { useMemo } from 'react';

import { listSubjects, type Subject } from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';

/** Liste des matières (rechargée automatiquement) + accès rapide par id. */
export function useSubjects() {
  const query = useLiveQuery(listSubjects, ['subjects'], []);
  const byId = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of query.data ?? []) map.set(s.id, s);
    return map;
  }, [query.data]);
  return { subjects: query.data ?? [], byId, loading: query.loading };
}
