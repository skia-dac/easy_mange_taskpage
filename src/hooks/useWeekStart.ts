import { defaultWeekStart, getWeekStart, type WeekStart } from '@/modules/identity';
import { settingTable, useSharedLiveQuery } from '@/shared/db';

const WEEK_START_TABLES = [settingTable('week_start')];

/** Premier jour de la semaine choisi dans les réglages (lundi par défaut), mis à jour en direct. */
export function useWeekStart(): WeekStart {
  // Lu une fois pour tous les écrans qui l'utilisent.
  const q = useSharedLiveQuery('setting:week_start', getWeekStart, WEEK_START_TABLES);
  return q.data ?? defaultWeekStart;
}
