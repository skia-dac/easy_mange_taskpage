import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWorkActions, type WorkTarget } from '@/hooks/useWorkActions';
import { postponeTargets } from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { ChoiceSheet } from '@/shared/ui';

type Target = WorkTarget;

/**
 * Menu « Reporter » : demain, dans 2 jours, lundi prochain, ou une autre date (formulaire).
 * `usePostpone()` renvoie la fonction qui ouvre le menu et l'élément à afficher dans l'écran.
 */
export function usePostpone(onDone?: () => void) {
  const { t } = useTranslation();
  const actions = useWorkActions();
  const [item, setItem] = useState<Target | null>(null);
  const close = () => setItem(null);

  const to = (date: string) => {
    if (!item) return;
    const target = item;
    close();
    void actions.postpone(target, date).then(onDone);
  };

  const targets = postponeTargets(toIsoDate(new Date()));
  const sheet = (
    <ChoiceSheet
      visible={item !== null}
      title={t('postpone.title')}
      message={item?.title}
      onClose={close}
      options={[
        { label: t('postpone.tomorrow'), onPress: () => to(targets.tomorrow) },
        { label: t('postpone.inTwoDays'), onPress: () => to(targets.inTwoDays) },
        { label: t('postpone.nextMonday'), onPress: () => to(targets.nextMonday) },
        {
          label: t('postpone.pickDate'),
          onPress: () => {
            const target = item;
            close();
            if (target)
              router.push({ pathname: '/work/form', params: { kind: target.kind, id: target.id } });
          },
        },
      ]}
    />
  );
  return { open: (w: Target) => setItem(w), sheet };
}
