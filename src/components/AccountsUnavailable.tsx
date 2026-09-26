import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/shared/ui';

/** Affiché quand cette version de l'app n'est pas reliée à un serveur (projet Supabase pas configuré). */
export function AccountsUnavailable() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="cloud-off"
      title={t('account.unavailable')}
      message={t('account.unavailableHint')}
    />
  );
}
