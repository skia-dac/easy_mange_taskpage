import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkActions, type WorkTarget } from '@/hooks/useWorkActions';
import { postponeTargets } from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { ChoiceSheet, type ChoiceOption } from '@/shared/ui';

type Target = WorkTarget;

/** « Reporter » n'a de sens que pour une tâche datée et pas encore faite. */
export function canPostpone(item: Pick<Target, 'dueDate' | 'status'>): boolean {
  return !!item.dueDate && item.status !== 'done';
}

/**
 * Menu « Reporter » : aujourd'hui (si l'échéance est passée), demain, dans 2 jours, lundi
 * prochain, une autre date (formulaire), ou retirer la date. Une tâche sans date n'a pas de menu.
 * `usePostpone()` renvoie la fonction qui ouvre le menu et l'élément à afficher dans l'écran.
 */
export function usePostpone(onDone?: () => void) {
  const { t } = useTranslation();
  const actions = useWorkActions();
  const [item, setItem] = useState<Target | null>(null);
  const close = () => setItem(null);

  const to = (date: string | null) => {
    if (!item) return;
    const target = item;
    close();
    void actions.postpone(target, date).then(onDone);
  };

  const today = toIsoDate(new Date());
  const targets = postponeTargets(today);
  const late = !!item?.dueDate && item.dueDate < today;
  const options: ChoiceOption[] = [
    ...(late ? [{ label: t('postpone.today'), onPress: () => to(today) }] : []),
    { label: t('postpone.tomorrow'), onPress: () => to(targets.tomorrow) },
    { label: t('postpone.inTwoDays'), onPress: () => to(targets.inTwoDays) },
    { label: t('postpone.nextMonday'), onPress: () => to(targets.nextMonday) },
    {
      // Le sélecteur de date seul n'existe pas hors du champ : la fiche s'ouvre sur la date.
      label: t('postpone.pickDate'),
      onPress: () => {
        const target = item;
        close();
        if (target)
          router.push({ pathname: '/work/form', params: { kind: target.kind, id: target.id } });
      },
    },
    { label: t('postpone.removeDate'), onPress: () => to(null) },
  ];
  const sheet = (
    <ChoiceSheet
      visible={item !== null}
      title={t('postpone.title')}
      message={item?.title}
      onClose={close}
      options={options}
    />
  );
  // Sans date : rien à reporter (le menu ne s'ouvre pas).
  const open = (w: Target) => {
    if (canPostpone(w)) setItem(w);
  };
  return { open, sheet };
}
