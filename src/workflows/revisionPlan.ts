import { ensureTimetable } from '@/modules/academic';
import { insertRevisionBlocks, type RevisionBlockInput } from '@/modules/productivity';
import { write, type Db } from '@/shared/db';

export type SaveRevisionPlan = {
  examId: string;
  subjectId: string;
  /** Nom donné à l'emploi du temps « Révisions » s'il faut le créer. */
  timetableName: string;
  blocks: readonly Pick<RevisionBlockInput, 'date' | 'startTime' | 'endTime' | 'title'>[];
  /** Remplacer les séances encore prévues de cet examen (refaire le plan). */
  replacePlanned: boolean;
};

/**
 * Enregistre un plan de révision validé par l'étudiant, en une transaction :
 * les séances rejoignent l'emploi du temps « Révisions » (créé ou agrandi si besoin).
 */
export async function saveRevisionPlan(db: Db, plan: SaveRevisionPlan): Promise<string[]> {
  if (plan.blocks.length === 0) return [];
  const dates = plan.blocks.map((b) => b.date).sort();
  return write(db, async (w) => {
    if (plan.replacePlanned) {
      const old = await w.db.getAllAsync<{ id: string }>(
        `SELECT id FROM revision_blocks WHERE deleted_at IS NULL AND exam_id = ? AND status = 'planned'`,
        [plan.examId],
      );
      for (const o of old) await w.softDelete('revision_blocks', o.id);
    }
    const timetableId = await ensureTimetable(
      w,
      'revision',
      dates[0] as string,
      dates[dates.length - 1] as string,
      plan.timetableName,
    );
    return insertRevisionBlocks(
      w,
      plan.blocks.map((b) => ({
        ...b,
        subjectId: plan.subjectId,
        examId: plan.examId,
        timetableId,
      })),
    );
  });
}
