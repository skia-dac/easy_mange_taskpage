import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/shared/ui';

export default function NotesScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('notes.title')}>
      <EmptyState icon="file-text" title={t('notes.empty')} message={t('notes.emptyHint')} />
    </Screen>
  );
}
