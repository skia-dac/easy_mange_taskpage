import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { CategoryBadge } from '@/components/money/CategoryBadge';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney } from '@/modules/finance';
import { useMoneyData, type MoneyInsight } from '@/projections';
import { formatShortDate, formatPercent } from '@/shared/format';
import { subjectColors, useTheme } from '@/shared/theme';
import { AppText, Card, EmptyState, LoadingScreen, SectionHeader, TextButton } from '@/shared/ui';

/** Bilan d'une période : entrées, dépenses, épargne, prêts ; où part l'argent ; quand ; conseils. */
export default function MoneyReportScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing, radius, colors, scheme } = useTheme();
  const [offset, setOffset] = useState(0);
  const data = useMoneyData(offset);
  const money = useMoneyLabels(data.data?.input.categories ?? []);

  if (data.error) return <EmptyState icon="alert-circle" title={t('errors.loadFailed')} />;
  if (!data.data) return <LoadingScreen />;
  const o = data.data.overview;
  const cur = o.currency;
  const fmt = (v: number) => formatMoney(v, cur);
  const top = o.byCategory[0]?.total ?? 0;

  const insight = (i: MoneyInsight) => {
    switch (i.kind) {
      case 'topWeekday':
        return t('money.insightWeekday', {
          day: labels.weekday(i.weekday),
          percent: Math.round(i.share * 100),
        });
      case 'categoryUp':
        return t('money.insightUp', { category: money.nameOf(i.categoryId), percent: i.percent });
      case 'repeating':
        return t('money.insightRepeat', {
          note: i.note,
          count: i.count,
          amount: fmt(i.averageMinor),
        });
    }
  };

  const tile = (label: string, value: string, color: 'success' | 'danger' | 'text' | 'warning') => (
    <View style={{ width: '48%', flexGrow: 1 }}>
      <Card>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="heading" color={color}>
          {value}
        </AppText>
      </Card>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.report') }} />
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {tile(t('money.incomes'), fmt(o.income), 'success')}
        {tile(t('money.expenses'), fmt(o.expense), 'danger')}
        {tile(t('money.savedPeriod'), fmt(o.saved), 'text')}
        {tile(t('money.lentPeriod'), fmt(o.lent), 'warning')}
      </View>
      <AppText color="muted">
        {t('money.reportBalance', { carry: fmt(o.carryOver), balance: fmt(o.balance) })}
      </AppText>

      <SectionHeader title={t('money.whereTitle')} />
      <Card>
        {o.byCategory.length === 0 ? (
          <AppText color="muted">{t('money.noExpenses')}</AppText>
        ) : null}
        {o.byCategory.map((c) => {
          const color =
            subjectColors.find((x) => x.id === c.category?.colorId) ??
            subjectColors[subjectColors.length - 1]!;
          return (
            <View
              key={c.categoryId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              <CategoryBadge category={c.category} size={34} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <AppText variant="bodyStrong">{money.categoryName(c.category)}</AppText>
                  <AppText color="muted">
                    {formatMoney(c.total, cur, { symbol: false })} · {formatPercent(c.share)}
                  </AppText>
                </View>
                <View
                  style={{
                    height: 8,
                    borderRadius: radius.sm,
                    backgroundColor: colors.background,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${top > 0 ? Math.max(4, Math.round((c.total / top) * 100)) : 0}%`,
                      height: 8,
                      backgroundColor: scheme === 'dark' ? color.strongDark : color.strong,
                    }}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </Card>

      {o.incomeByCategory.length > 0 ? (
        <>
          <SectionHeader title={t('money.incomeFrom')} />
          <Card>
            {o.incomeByCategory.map((c) => (
              <View
                key={c.categoryId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.xs,
                }}
              >
                <CategoryBadge category={c.category} size={34} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {money.categoryName(c.category)}
                </AppText>
                <AppText color="success">
                  {formatMoney(c.total, cur, { signed: true, symbol: false })}
                </AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Card>
        <AppText variant="bodyStrong">{t('money.byWeekday')}</AppText>
        <BarChart
          bars={o.byWeekday.map((d) => ({
            label: labels.weekday(d.weekday, 'short'),
            value: d.total,
            tone: 'primary' as const,
          }))}
          max={Math.max(1, ...o.byWeekday.map((d) => d.total))}
          height={90}
          valueLabel={(v) => (v > 0 ? formatMoney(v, cur, { symbol: false }) : '')}
          accessibilityLabel={t('money.byWeekday')}
        />
      </Card>

      {o.largest.length > 0 ? (
        <>
          <SectionHeader title={t('money.largest')} />
          <Card>
            {o.largest.map((x) => (
              <View
                key={x.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.xs,
                }}
              >
                <AppText style={{ flex: 1 }} numberOfLines={1}>
                  {[money.nameOf(x.categoryId), x.note].filter(Boolean).join(' · ')}
                </AppText>
                <AppText variant="bodyStrong">{fmt(x.amountMinor)}</AppText>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {o.insights.length > 0 ? (
        <>
          <SectionHeader title={t('money.insights')} />
          <Card>
            {o.insights.map((i, k) => (
              <View key={k} style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
                <AppText>{`• ${insight(i)}`}</AppText>
                {i.kind === 'repeating' ? (
                  <TextButton
                    label={t('money.makeRecurring')}
                    onPress={() =>
                      router.push({
                        pathname: '/money/recurring-form',
                        params: {
                          name: i.note,
                          category: i.categoryId,
                          amount: String(i.averageMinor),
                        },
                      })
                    }
                  />
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
