import { defaultWeekStart, getWeekStart, type WeekStart } from '@/modules/identity';
import { useLiveQuery } from '@/shared/db';

/** Premier jour de la semaine choisi dans les réglages (lundi par défaut), mis à jour en direct. */
export function useWeekStart(): WeekStart {
  const q = useLiveQuery((db) => getWeekStart(db), ['app_settings'], []);
  return q.data ?? defaultWeekStart;
}
