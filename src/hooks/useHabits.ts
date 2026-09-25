import { useMemo } from 'react';

import { listHabitLogs, listHabits } from '@/modules/productivity';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';

/** Habitudes + journal (400 jours), rechargés à chaque changement. */
export function useHabits() {
  const today = toIsoDate(new Date());
  const habits = useLiveQuery(listHabits, ['habits'], []);
  const logs = useLiveQuery(
    (db) => listHabitLogs(db, addDaysIso(today, -400), addDaysIso(today, 7)),
    ['habit_logs'],
    [today],
  );
  const loading = habits.loading || logs.loading;
  return useMemo(
    () => ({ habits: habits.data ?? [], logs: logs.data ?? [], loading, today }),
    [habits.data, logs.data, loading, today],
  );
}
