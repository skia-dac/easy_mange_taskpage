import { listCourseSeries, listExams, removeSubjectAndCourses } from '@/modules/academic';
import {
  countWorkForSubject,
  deleteWorkOfSubject,
  detachWorkFromSubject,
} from '@/modules/productivity';
import { write, type Db } from '@/shared/db';

export type SubjectUsage = { courses: number; exams: number; tasks: number; assignments: number };

/** Ce qui est lié à une matière : affiché AVANT de la supprimer (spécification §16). */
export async function subjectUsage(db: Db, subjectId: string): Promise<SubjectUsage> {
  const [series, exams, work] = await Promise.all([
    listCourseSeries(db, { subjectId }),
    listExams(db, { subjectId }),
    countWorkForSubject(db, subjectId),
  ]);
  return { courses: series.length, exams: exams.length, ...work };
}

/**
 * - `keepWork` : les tâches et devoirs restent, sans matière. Les cours et examens sont supprimés
 *   (un examen a toujours une matière, règle 6) : l'écran l'annonce clairement.
 * - `deleteAll` : tout ce qui est lié est supprimé.
 * Tout se fait dans une seule transaction.
 */
export async function deleteSubject(db: Db, subjectId: string, mode: 'keepWork' | 'deleteAll') {
  return write(db, async (w) => {
    const exams = await w.db.getAllAsync<{ id: string }>(
      'SELECT id FROM exams WHERE subject_id = ? AND deleted_at IS NULL',
      [subjectId],
    );
    for (const e of exams) await w.softDelete('exams', e.id);
    if (mode === 'keepWork') await detachWorkFromSubject(w, subjectId);
    else await deleteWorkOfSubject(w, subjectId);
    await removeSubjectAndCourses(w, subjectId);
  });
}
