import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import type { OffPeriod } from '@/modules/academic';
import { IconBadge, ListRow } from '@/shared/ui';

/** Vacances ou jour sans cours dans le calendrier (§37). */
export function DayOffRow({ period }: { period: OffPeriod }) {
  const { t } = useTranslation();
  return (
    <ListRow
      title={period.suspendCourses ? t('calendar.dayOff', { name: period.name }) : period.name}
      subtitle={t(`offPeriods.${period.kind}`)}
      leading={
        <IconBadge
          icon={period.kind === 'holiday' ? 'sun' : 'flag'}
          color="warning"
          background="warningSoft"
        />
      }
      onPress={() => router.push({ pathname: '/off-periods/form', params: { id: period.id } })}
    />
  );
}
