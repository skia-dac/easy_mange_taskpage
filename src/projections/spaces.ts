import { isSlotEvent, isWorkVisible } from '@/modules/productivity';
import type { ActiveSpaces } from '@/shared/spaces';

import type { TodayData } from './today';

/**
 * Ce que montrent les écrans selon les espaces actifs. Rien n'est supprimé ni modifié :
 * les données d'un espace coupé sont seulement retirées de l'affichage et des rappels.
 * - Études : cours, examens, révisions, vacances, devoirs.
 * - Perso : habitudes, humeur, argent (charges fixes, tontines).
 * - Pro ou Perso : créneaux qui se répètent.
 * - Tâches, rendez-vous, notes : communs aux trois espaces, jamais filtrés par espace.
 */
export function filterBySpaces(data: TodayData, active: ActiveSpaces): TodayData {
  const study = active.includes('study');
  const personal = active.includes('personal');
  const slots = personal || active.includes('work');
  return {
    ...data,
    series: study ? data.series : [],
    exceptions: study ? data.exceptions : [],
    offPeriods: study ? data.offPeriods : [],
    exams: study ? data.exams : [],
    revisionBlocks: study ? data.revisionBlocks : [],
    work: data.work.filter((w) => isWorkVisible(w, active)),
    events: slots ? data.events : data.events.filter((e) => !isSlotEvent(e)),
    habits: personal ? data.habits : [],
    habitLogs: personal ? data.habitLogs : [],
    moodLogs: personal ? data.moodLogs : [],
    money: personal ? data.money : undefined,
  };
}
