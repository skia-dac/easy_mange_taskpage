import { useMemo } from 'react';

import { listSubjects, type Subject } from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';

const none: Subject[] = [];

/**
 * Liste des matières (rechargée automatiquement) + accès rapide par id.
 * Les matières appartiennent à Études : sans Études, la liste est vide, donc aucune matière
 * ne s'affiche sur une tâche ou une note (le lien reste enregistré, seulement caché).
 */
export function useSubjects() {
  const study = useSpaces().has('study');
  const query = useLiveQuery(listSubjects, ['subjects'], []);
  const subjects = study ? (query.data ?? none) : none;
  const byId = useMemo(() => {
    const map = new Map<string, Subject>();
    for (const s of subjects) map.set(s.id, s);
    return map;
  }, [subjects]);
  return { subjects, byId, loading: query.loading };
}
