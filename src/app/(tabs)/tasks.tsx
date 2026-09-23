import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/shared/ui';

export default function TasksScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('tasks.title')}>
      <EmptyState icon="check-square" title={t('tasks.empty')} message={t('tasks.emptyHint')} />
    </Screen>
  );
}
