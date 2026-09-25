import { deleteLocalFile } from '@/modules/platform';
import { deleteHabit, listCheckpoints } from '@/modules/productivity';
import type { Db } from '@/shared/db';

/** Supprime une habitude, son historique, ses points de suivi et leurs photos sur le téléphone. */
export async function deleteHabitEverywhere(db: Db, habitId: string): Promise<void> {
  const photos = (await listCheckpoints(db, habitId))
    .map((c) => c.photoPath)
    .filter((p): p is string => !!p);
  await deleteHabit(db, habitId);
  for (const p of photos) deleteLocalFile(p);
}
