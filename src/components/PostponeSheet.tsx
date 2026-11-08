import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkActions, type WorkTarget } from '@/hooks/useWorkActions';
import { postponeTargets } from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { ChoiceSheet, useDateTimePicker, type ChoiceOption } from '@/shared/ui';

type Target = WorkTarget;

/** « Reporter » n'a de sens que pour une tâche datée et pas encore faite. */
export function canPostpone(item: Pick<Target, 'dueDate' | 'status'>): boolean {
  return !!item.dueDate && item.status !== 'done';
}

/**
 * Menu « Reporter » : aujourd'hui (si l'échéance n'est pas aujourd'hui, en retard comme à venir),
 * demain, dans 2 jours, lundi prochain, une autre date (le sélecteur de date s'ouvre directement),
 * ou retirer la date. Une tâche sans date n'a pas de menu.
 * `usePostpone()` renvoie la fonction qui ouvre le menu et l'élément à afficher dans l'écran.
 */
export function usePostpone(onDone?: () => void) {
  const { t } = useTranslation();
  const actions = useWorkActions();
  const [item, setItem] = useState<Target | null>(null);
  const picker = useDateTimePicker('date', t('postpone.pickDateTitle'));
  const close = () => setItem(null);

  const postpone = (target: Target, date: string | null) =>
    void actions.postpone(target, date).then(onDone);

  const to = (date: string | null) => {
    if (!item) return;
    const target = item;
    close();
    postpone(target, date);
  };

  const today = toIsoDate(new Date());
  const targets = postponeTargets(today);
  const notToday = !!item?.dueDate && item.dueDate !== today;
  const options: ChoiceOption[] = [
    // Aussi pour avancer une tâche prévue plus tard.
    ...(notToday ? [{ label: t('postpone.today'), onPress: () => to(today) }] : []),
    { label: t('postpone.tomorrow'), onPress: () => to(targets.tomorrow) },
    { label: t('postpone.inTwoDays'), onPress: () => to(targets.inTwoDays) },
    { label: t('postpone.nextMonday'), onPress: () => to(targets.nextMonday) },
    {
      label: t('postpone.pickDate'),
      // Le sélecteur est une autre fenêtre : il s'ouvre une fois ce menu fermé.
      afterDismiss: true,
      onPress: () => {
        const target = item;
        if (!target) return;
        picker.open(target.dueDate, (date) => postpone(target, date), today);
      },
    },
    { label: t('postpone.removeDate'), onPress: () => to(null) },
  ];
  const sheet = (
    <>
      <ChoiceSheet
        visible={item !== null}
        title={t('postpone.title')}
        message={item?.title}
        onClose={close}
        options={options}
      />
      {picker.element}
    </>
  );
  // Sans date : rien à reporter (le menu ne s'ouvre pas).
  const open = (w: Target) => {
    if (canPostpone(w)) setItem(w);
  };
  return { open, sheet };
}
