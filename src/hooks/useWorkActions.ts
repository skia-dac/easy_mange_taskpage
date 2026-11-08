import { useTranslation } from 'react-i18next';

import { useLabels } from '@/hooks/useLabels';
import {
  rescheduleWorkItem,
  setWorkStatus,
  undoWorkDone,
  type WorkItem,
} from '@/modules/productivity';
import { addDaysIso, toIsoDate, type IsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { showError, showUndoToast } from '@/shared/ui';

export type WorkTarget = Pick<
  WorkItem,
  'id' | 'kind' | 'title' | 'dueDate' | 'dueTime' | 'repeat' | 'status'
>;

/**
 * Terminer / rouvrir / reporter une tâche ou un devoir, avec un message discret et « Annuler ».
 * Une tâche répétée terminée crée la suivante : « Annuler » la supprime aussi.
 */
export function useWorkActions() {
  const { t } = useTranslation();
  const db = useDb();
  const labels = useLabels();
  const fail = (e: unknown) => showError(userMessageKey(e));

  const setDone = (item: WorkTarget, done: boolean) =>
    setWorkStatus(db, item.kind, item.id, done ? 'done' : 'todo').then((spawnedId) => {
      if (!done) return;
      // On restaure l'état d'avant (« à faire » ou « en cours »), pas forcément « à faire »,
      // et on retire l'occurrence suivante créée pour une tâche répétée.
      const previous = item.status === 'done' ? 'todo' : item.status;
      showUndoToast({ title: t('work.doneToast'), detail: item.title }, () =>
        undoWorkDone(db, item.kind, item.id, previous, spawnedId),
      );
    }, fail);

  /** « Reportée à demain », « Reportée au 12 nov. » ou « Date retirée ». */
  const postponedTitle = (date: IsoDate | null) => {
    if (!date) return t('postpone.removedToast');
    if (date === addDaysIso(toIsoDate(new Date()), 1)) return t('postpone.tomorrowToast');
    return t('postpone.doneToast', { date: formatShortDate(date, labels.lang) });
  };

  /** Nouvelle échéance ; `null` retire la date (la tâche passe « Sans date »). */
  const postpone = (item: WorkTarget, date: IsoDate | null) =>
    rescheduleWorkItem(db, item.kind, item.id, date).then(
      () =>
        showUndoToast({ title: postponedTitle(date), detail: item.title }, () =>
          rescheduleWorkItem(db, item.kind, item.id, item.dueDate, item.dueTime),
        ),
      fail,
    );

  return { setDone, postpone };
}
