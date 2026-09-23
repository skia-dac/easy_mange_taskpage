import { getProfile } from '@/modules/identity';
import { useLiveQuery } from '@/shared/db';

/** Profil de l'étudiant, rechargé après modification. */
export function useProfile() {
  const q = useLiveQuery(getProfile, ['profiles'], []);
  return { profile: q.data ?? null, loading: q.loading };
}
