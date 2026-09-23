import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/shared/ui';

export default function CalendarScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('calendar.title')}>
      <EmptyState icon="calendar" title={t('calendar.empty')} message={t('calendar.emptyHint')} />
    </Screen>
  );
}
