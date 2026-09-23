import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/shared/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('profile.title')}>
      <EmptyState
        icon="book-open"
        title={t('profile.emptySubjects')}
        message={t('profile.emptySubjectsHint')}
      />
    </Screen>
  );
}
