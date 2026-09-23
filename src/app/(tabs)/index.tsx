import { useTranslation } from 'react-i18next';

import { formatLongDate } from '@/shared/format';
import { EmptyState, Screen } from '@/shared/ui';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  return (
    <Screen title={t('today.greeting')} subtitle={formatLongDate(new Date(), i18n.language)}>
      <EmptyState
        icon="sun"
        title={t('today.emptyCourses')}
        message={t('today.emptyCoursesHint')}
      />
    </Screen>
  );
}
