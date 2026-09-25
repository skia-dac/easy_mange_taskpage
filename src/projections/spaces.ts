import { workSpace } from '@/modules/productivity';
import type { ActiveSpaces } from '@/shared/spaces';

import type { TodayData } from './today';

/**
 * Ce que montrent les écrans selon les espaces actifs. Rien n'est supprimé ni modifié :
 * les données d'un espace coupé sont seulement retirées de l'affichage et des rappels.
 * - Études : cours, examens, révisions, vacances, devoirs et tout ce qui est lié à une matière.
 * - Perso : habitudes, humeur, argent (charges fixes, tontines).
 * - Tâches et événements : selon leur espace.
 */
export function filterBySpaces(data: TodayData, active: ActiveSpaces): TodayData {
  const study = active.includes('study');
  const personal = active.includes('personal');
  return {
    ...data,
    series: study ? data.series : [],
    exceptions: study ? data.exceptions : [],
    offPeriods: study ? data.offPeriods : [],
    exams: study ? data.exams : [],
    revisionBlocks: study ? data.revisionBlocks : [],
    work: data.work.filter((w) => active.includes(workSpace(w))),
    events: data.events.filter((e) => active.includes(e.space)),
    habits: personal ? data.habits : [],
    habitLogs: personal ? data.habitLogs : [],
    moodLogs: personal ? data.moodLogs : [],
    money: personal ? data.money : undefined,
  };
}
