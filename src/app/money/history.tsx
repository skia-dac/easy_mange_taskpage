import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { TransactionRow } from '@/components/money/TransactionRow';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney, isInflow, type Transaction } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { fromIsoDate } from '@/shared/dates';
import { formatLongDate, formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  Segmented,
  TextButton,
} from '@/shared/ui';

type Filter = 'all' | 'expense' | 'income';

/** Toutes les opérations d'une période, jour par jour. */
export default function MoneyHistoryScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ filter?: string; offset?: string }>();
  const [offset, setOffset] = useState(Number(params.offset ?? 0) || 0);
  const [filter, setFilter] = useState<Filter>(
    params.filter === 'expense' || params.filter === 'income' ? params.filter : 'all',
  );
  const data = useMoneyData(offset);
  const days = useMemo(() => {
    const items = (data.data?.overview.items ?? []).filter((i) =>
      filter === 'all' ? true : filter === 'income' ? isInflow(i.kind) : !isInflow(i.kind),
    );
    const map = new Map<string, Transaction[]>();
    for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    return [...map.entries()];
  }, [data.data, filter]);

  if (data.error) return <EmptyState icon="alert-circle" title={t('errors.loadFailed')} />;
  if (!data.data) return <LoadingScreen />;
  const o = data.data.overview;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.history') }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextButton label={`‹ ${t('money.previous')}`} onPress={() => setOffset(offset - 1)} />
        <AppText variant="bodyStrong">
          {t('money.periodRange', {
            from: formatShortDate(o.range.from, labels.lang),
            to: formatShortDate(o.range.to, labels.lang),
          })}
        </AppText>
        <TextButton label={`${t('money.next')} ›`} onPress={() => setOffset(offset + 1)} />
      </View>
      <Segmented
        accessibilityLabel={t('money.filterLabel')}
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('money.all') },
          { value: 'expense', label: t('money.expenses') },
          { value: 'income', label: t('money.incomes') },
        ]}
      />
      {days.length === 0 ? <EmptyState icon="list" title={t('money.noItems')} /> : null}
      {days.map(([date, items]) => {
        const total = items.reduce(
          (s, i) => s + (isInflow(i.kind) ? i.amountMinor : -i.amountMinor),
          0,
        );
        return (
          <View key={date} style={{ gap: spacing.sm }}>
            <SectionHeader
              title={`${formatLongDate(fromIsoDate(date), labels.lang)} · ${formatMoney(total, o.currency, { signed: true })}`}
            />
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
          </View>
        );
      })}
    </ScrollView>
  );
}
