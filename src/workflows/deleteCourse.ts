import { removeCourse } from '@/modules/academic';
import { detachNotesFromCourse } from '@/modules/productivity';
import { write, type Db } from '@/shared/db';

/** Supprime un cours (et ses exceptions) ; ses notes restent, détachées. Une seule transaction. */
export async function deleteCourseEverywhere(db: Db, seriesId: string): Promise<void> {
  await write(db, async (w) => {
    await detachNotesFromCourse(w, seriesId);
    await removeCourse(w, seriesId);
  });
}
