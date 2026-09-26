import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useLabels } from '@/hooks/useLabels';
import { formatMoney } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { AppText, Card, SectionHeader } from '@/shared/ui';

import { TransactionRow } from './TransactionRow';

/** Bilan du soir : l'argent du jour, pour ne rien oublier de noter. */
export function ReviewMoney() {
  const { t } = useTranslation();
  const labels = useLabels();
  const data = useMoneyData(0);
  const o = data.data?.overview;
  if (!o) return null;
  const today = data.data?.input.today;
  const items = o.items.filter((i) => i.date === today);
  return (
    <>
      <SectionHeader
        title={t('review.money', { amount: formatMoney(o.todaySpent, o.currency) })}
        action={{
          label: t('money.addShort'),
          onPress: () => router.push({ pathname: '/money/add', params: { kind: 'expense' } }),
        }}
      />
      {items.length === 0 ? (
        <AppText color="muted">{t('review.moneyNone')}</AppText>
      ) : (
        <Card>
          {items.map((i) => (
            <TransactionRow
              key={i.id}
              item={i}
              categories={data.data?.input.categories ?? []}
              lang={labels.lang}
            />
          ))}
        </Card>
      )}
    </>
  );
}
