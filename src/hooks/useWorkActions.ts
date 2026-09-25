import { useTranslation } from 'react-i18next';

import { useLabels } from '@/hooks/useLabels';
import { rescheduleWorkItem, setWorkStatus, type WorkItem } from '@/modules/productivity';
import type { IsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { showError, showToast, showUndoToast } from '@/shared/ui';

export type WorkTarget = Pick<WorkItem, 'id' | 'kind' | 'title' | 'dueDate' | 'dueTime' | 'repeat'>;

/**
 * Terminer / rouvrir / reporter une tâche ou un devoir, avec un message discret et « Annuler ».
 * Une tâche répétée terminée crée déjà la suivante : pas d'annulation dans ce cas.
 */
export function useWorkActions() {
  const { t } = useTranslation();
  const db = useDb();
  const labels = useLabels();
  const fail = (e: unknown) => showError(userMessageKey(e));

  const setDone = (item: WorkTarget, done: boolean) =>
    setWorkStatus(db, item.kind, item.id, done ? 'done' : 'todo').then(() => {
      if (!done) return;
      const message = t('work.doneToast', { title: item.title });
      if (item.repeat !== 'none') showToast(message);
      else showUndoToast(message, () => setWorkStatus(db, item.kind, item.id, 'todo'));
    }, fail);

  const postpone = (item: WorkTarget, date: IsoDate) =>
    rescheduleWorkItem(db, item.kind, item.id, date).then(
      () =>
        showUndoToast(t('postpone.doneToast', { date: formatShortDate(date, labels.lang) }), () =>
          rescheduleWorkItem(db, item.kind, item.id, item.dueDate, item.dueTime),
        ),
      fail,
    );

  return { setDone, postpone };
}
