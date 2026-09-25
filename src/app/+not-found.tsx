import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppText, EmptyState, Screen } from '@/shared/ui';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('app.name')}>
      <EmptyState icon="compass" title={t('errors.notFound')} />
      <Link href="/">
        <AppText variant="bodyStrong" color="primary">
          {t('errors.backHome')}
        </AppText>
      </Link>
    </Screen>
  );
}
