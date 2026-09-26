import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { TransactionRow } from '@/components/money/TransactionRow';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { HeaderButton } from '@/components/SearchButton';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney, payDue, unpayDue, type DueItem } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Fab,
  IconBadge,
  CountUpText,
  ListRow,
  LoadingScreen,
  RiseIn,
  Screen,
  SectionHeader,
  showError,
} from '@/shared/ui';

/** Onglet Argent : ce qu'il te reste, ce qui est à payer, tes dernières opérations. */
export default function MoneyScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing, radius } = useTheme();
  const [offset, setOffset] = useState(0);
  const data = useMoneyData(offset);
  const money = useMoneyLabels(data.data?.input.categories ?? []);

  if (!data.data) return <LoadingScreen />;
  const { overview: o, input } = data.data;
  const cur = o.currency;
  const fmt = (v: number) => formatMoney(v, cur);
  const today = toIsoDate(new Date());
  const current = offset === 0;
  const empty = o.items.length === 0 && o.carryOver === 0;
  const spentShare =
    o.income + Math.max(0, o.carryOver) > 0
      ? Math.min(1, o.expense / (o.income + Math.max(0, o.carryOver)))
      : 0;

  const togglePaid = (d: DueItem) => {
    const job = d.paid
      ? unpayDue(db, d.recurring.id, d.date)
      : payDue(db, d.recurring.id, d.date, current ? today : d.date);
    job.catch((e: unknown) => showError(userMessageKey(e)));
  };

  const nav = (icon: 'chevron-left' | 'chevron-right', dir: -1 | 1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? t('money.previous') : t('money.next')}
      onPress={() => setOffset(offset + dir)}
      style={{
        width: minTouchSize,
        height: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={24} color={colors.primary} />
    </Pressable>
  );

  const tile = (label: string, value: ReactNode, onPress?: () => void) => (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{ flexGrow: 1 }}
    >
      <Card>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        {value}
      </Card>
    </Pressable>
  );

  const unpaid = o.due.filter((d) => !d.paid);
  const shownDue = [...unpaid, ...o.due.filter((d) => d.paid)].slice(0, 6);

  return (
    <View style={{ flex: 1 }}>
      <Screen
        stagger
        title={t('money.title')}
        actions={
          <>
            <HeaderButton icon="bar-chart-2" label={t('money.report')} href="/money/report" />
            <HeaderButton icon="sliders" label={t('money.settings')} href="/money/settings" />
          </>
        }
      >
        <RiseIn>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            {nav('chevron-left', -1)}
            <Pressable accessibilityRole="button" onPress={() => setOffset(0)} hitSlop={8}>
              <AppText variant="bodyStrong">
                {t('money.periodRange', {
                  from: formatShortDate(o.range.from, labels.lang),
                  to: formatShortDate(o.range.to, labels.lang),
                })}
              </AppText>
            </Pressable>
            {nav('chevron-right', 1)}
          </View>
        </RiseIn>

        <RiseIn>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: radius.xl,
              padding: spacing.xl,
              gap: spacing.sm,
            }}
          >
            <AppText variant="label" color="onPrimary" style={{ letterSpacing: 1 }}>
              {(current ? t('money.left') : t('money.leftAtEnd')).toLocaleUpperCase()}
            </AppText>
            <CountUpText
              variant="title"
              color="onPrimary"
              style={{ fontSize: 36, lineHeight: 42 }}
              value={o.balance}
              format={(n) => formatMoney(n, cur)}
            />
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primarySoft,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.round((1 - spentShare) * 100)}%`,
                  height: 8,
                  backgroundColor: colors.onPrimary,
                }}
              />
            </View>
            {current && o.unpaidTotal > 0 ? (
              <AppText color="onPrimary">
                {t('money.afterCharges', { amount: fmt(o.afterCharges), perDay: fmt(o.perDay) })}
              </AppText>
            ) : current ? (
              <AppText color="onPrimary">
                {t('money.perDay', { perDay: fmt(o.perDay), days: o.daysLeft })}
              </AppText>
            ) : null}
            {o.carryOver !== 0 ? (
              <AppText variant="caption" color="onPrimary">
                {t('money.carryOver', { amount: fmt(o.carryOver) })}
              </AppText>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  label={`− ${t('money.expense')}`}
                  onPress={() =>
                    router.push({ pathname: '/money/add', params: { kind: 'expense' } })
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  label={`+ ${t('money.income')}`}
                  onPress={() =>
                    router.push({ pathname: '/money/add', params: { kind: 'income' } })
                  }
                />
              </View>
            </View>
          </View>
        </RiseIn>

        {empty ? (
          <EmptyState
            icon="credit-card"
            title={t('money.emptyTitle')}
            message={t('money.emptyHint')}
          />
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          <RiseIn style={{ width: '48%', flexGrow: 1 }}>
            {tile(
              t('money.incomes'),
              <CountUpText
                variant="heading"
                color="success"
                value={o.income}
                format={(n) => formatMoney(n, cur, { signed: true })}
              />,
              () =>
                router.push({
                  pathname: '/money/history',
                  params: { filter: 'income', offset: String(offset) },
                }),
            )}
          </RiseIn>
          <RiseIn style={{ width: '48%', flexGrow: 1 }}>
            {tile(
              t('money.expenses'),
              <CountUpText
                variant="heading"
                color="danger"
                value={-o.expense}
                format={(n) => formatMoney(n, cur)}
              />,
              () =>
                router.push({
                  pathname: '/money/history',
                  params: { filter: 'expense', offset: String(offset) },
                }),
            )}
          </RiseIn>
          <RiseIn style={{ width: '48%', flexGrow: 1 }}>
            {tile(
              t('money.savings'),
              <CountUpText
                variant="heading"
                value={o.goals.reduce((s, g) => s + g.savedMinor, 0)}
                format={(n) => formatMoney(n, cur)}
              />,
              () => router.push('/money/goals'),
            )}
          </RiseIn>
          <RiseIn style={{ width: '48%', flexGrow: 1 }}>
            {tile(
              t('money.loans'),
              <CountUpText
                variant="heading"
                color="warning"
                value={o.loans
                  .filter((l) => l.loan.direction === 'lent')
                  .reduce((s, l) => s + l.outstandingMinor, 0)}
                format={(n) => formatMoney(n, cur)}
              />,
              () => router.push('/money/loans'),
            )}
          </RiseIn>
        </View>

        <RiseIn>
          <SectionHeader
            title={
              o.unpaidTotal > 0
                ? t('money.dueTitleAmount', { amount: fmt(o.unpaidTotal) })
                : t('money.dueTitle')
            }
            action={{ label: t('money.manage'), onPress: () => router.push('/money/recurring') }}
          />
        </RiseIn>
        {o.due.length === 0 ? (
          <RiseIn>
            <Card>
              <ListRow
                title={t('money.addRecurring')}
                subtitle={t('money.addRecurringHint')}
                leading={<IconBadge icon="repeat" />}
                onPress={() => router.push('/money/recurring-form')}
              />
            </Card>
          </RiseIn>
        ) : (
          <Card>
            {shownDue.map((d) => (
              <RiseIn key={`${d.recurring.id}-${d.date}`}>
                <ListRow
                  title={d.recurring.name}
                  struck={d.paid}
                  subtitle={[
                    d.recurring.kind === 'tontine' ? t('money.tontine') : null,
                    formatShortDate(d.date, labels.lang),
                    d.recurring.time,
                    d.paid ? t('money.paid') : d.date < today ? t('money.late') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  leading={
                    <Checkbox
                      checked={d.paid}
                      accessibilityLabel={t('money.markPaid', { name: d.recurring.name })}
                      onToggle={() => togglePaid(d)}
                    />
                  }
                  trailing={
                    <AppText variant="bodyStrong">
                      {formatMoney(d.amountMinor, cur, { symbol: false })}
                    </AppText>
                  }
                  onPress={() =>
                    router.push({
                      pathname: '/money/recurring-form',
                      params: { id: d.recurring.id },
                    })
                  }
                />
              </RiseIn>
            ))}
          </Card>
        )}

        {o.tontines.some((x) => x.payoutDate) ? (
          <Card>
            {o.tontines
              .filter((x) => x.payoutDate)
              .map((x) => (
                <RiseIn key={x.recurring.id}>
                  <ListRow
                    title={t('money.myTurn', { name: x.recurring.name })}
                    subtitle={t('money.myTurnHint', {
                      date: formatShortDate(x.payoutDate ?? '', labels.lang),
                      amount: fmt(x.recurring.payoutMinor ?? 0),
                    })}
                    leading={<CategoryBadge category={money.categoryOf('tontine_in')} />}
                    onPress={() =>
                      router.push({
                        pathname: '/money/recurring-form',
                        params: { id: x.recurring.id },
                      })
                    }
                  />
                </RiseIn>
              ))}
          </Card>
        ) : null}

        <RiseIn>
          <SectionHeader
            title={t('money.recent')}
            action={
              o.items.length > 0
                ? {
                    label: t('common.seeAll'),
                    onPress: () =>
                      router.push({
                        pathname: '/money/history',
                        params: { offset: String(offset) },
                      }),
                  }
                : undefined
            }
          />
        </RiseIn>
        {o.items.length === 0 ? (
          <RiseIn>
            <AppText color="muted">{t('money.noItems')}</AppText>
          </RiseIn>
        ) : (
          <Card>
            {o.items.slice(0, 8).map((item) => (
              <RiseIn key={item.id}>
                <TransactionRow
                  item={item}
                  categories={input.categories}
                  lang={labels.lang}
                  showDate
                />
              </RiseIn>
            ))}
          </Card>
        )}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab accessibilityLabel={t('money.addExpense')} onPress={() => router.push('/money/add')} />
    </View>
  );
}
