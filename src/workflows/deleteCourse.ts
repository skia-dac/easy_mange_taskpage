import {
  endSeriesBeforeIn,
  removeCourse,
  removeTimetable,
  seriesIdsOfTimetable,
  splitSeriesIn,
  type CourseInput,
} from '@/modules/academic';
import { detachNotesFromCourse, moveNotesToSeries } from '@/modules/productivity';
import type { IsoDate } from '@/shared/dates';
import { write, type Db } from '@/shared/db';

/** Supprime un cours (et ses exceptions) ; ses notes restent, détachées. Une seule transaction. */
export async function deleteCourseEverywhere(db: Db, seriesId: string): Promise<void> {
  await write(db, async (w) => {
    await detachNotesFromCourse(w, seriesId);
    await removeCourse(w, seriesId);
  });
}

/**
 * Supprime un emploi du temps, ses cours et leurs exceptions ; les notes de ces cours restent,
 * détachées (elles gardent leur matière). Une seule transaction.
 */
export async function deleteTimetableEverywhere(db: Db, timetableId: string): Promise<void> {
  await write(db, async (w) => {
    for (const seriesId of await seriesIdsOfTimetable(w, timetableId)) {
      await detachNotesFromCourse(w, seriesId);
    }
    await removeTimetable(w, timetableId);
  });
}

/**
 * « Ce cours et les suivants » (modification) : la série est coupée à `date` et les notes prises à
 * partir de ce jour suivent la nouvelle série. Retourne l'id de la série qui porte `date`.
 */
export async function splitSeriesEverywhere(
  db: Db,
  seriesId: string,
  date: IsoDate,
  input: CourseInput,
): Promise<string> {
  return write(db, async (w) => {
    const newId = await splitSeriesIn(w, seriesId, date, input);
    if (newId !== seriesId) await moveNotesToSeries(w, seriesId, newId, date);
    return newId;
  });
}

/**
 * « Ce cours et les suivants » (suppression) : la série s'arrête la veille de `date` ; si rien ne la
 * précède, elle disparaît entièrement et ses notes sont détachées.
 */
export async function endCourseSeriesEverywhere(
  db: Db,
  seriesId: string,
  date: IsoDate,
): Promise<void> {
  await write(db, async (w) => {
    const removed = await endSeriesBeforeIn(w, seriesId, date);
    if (removed) await detachNotesFromCourse(w, seriesId);
  });
}
