import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { TransactionRow } from '@/components/money/TransactionRow';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { HeaderButton } from '@/components/SearchButton';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney, payDue, unpayDue, type DueItem } from '@/modules/finance';
import { openLoans, useMoneyData } from '@/projections';
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
  ListRow,
  LoadingScreen,
  Screen,
  SectionHeader,
  showError,
  showUndoToast,
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

  if (data.error) return <EmptyState icon="alert-circle" title={t('errors.loadFailed')} />;
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
    if (!d.paid) {
      payDue(db, d.recurring.id, d.date, current ? today : d.date).catch((e: unknown) =>
        showError(userMessageKey(e)),
      );
      return;
    }
    // Décocher supprime la dépense : « Annuler » la recrée telle quelle (même date, même montant).
    const paidTx = input.transactions.find((x) => x.id === d.transactionId);
    unpayDue(db, d.recurring.id, d.date).then(
      () =>
        showUndoToast(t('money.unpaidToast', { name: d.recurring.name }), () =>
          payDue(db, d.recurring.id, d.date, paidTx?.date ?? d.date, paidTx?.amountMinor),
        ),
      (e: unknown) => showError(userMessageKey(e)),
    );
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

  const tile = (
    label: string,
    value: string,
    color: 'success' | 'danger' | 'text' | 'warning',
    onPress?: () => void,
  ) => (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={{ width: '48%', flexGrow: 1 }}
    >
      <Card>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="heading" color={color}>
          {value}
        </AppText>
      </Card>
    </Pressable>
  );

  const unpaid = o.due.filter((d) => !d.paid);
  const shownDue = [...unpaid, ...o.due.filter((d) => d.paid)].slice(0, 6);

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={t('money.title')}
        actions={
          <>
            <HeaderButton icon="bar-chart-2" label={t('money.report')} href="/money/report" />
            <HeaderButton icon="sliders" label={t('money.settings')} href="/money/settings" />
          </>
        }
      >
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
          <AppText variant="title" color="onPrimary" style={{ fontSize: 36, lineHeight: 42 }}>
            {fmt(o.balance)}
          </AppText>
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
                onPress={() => router.push({ pathname: '/money/add', params: { kind: 'expense' } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                label={`+ ${t('money.income')}`}
                onPress={() => router.push({ pathname: '/money/add', params: { kind: 'income' } })}
              />
            </View>
          </View>
        </View>

        {empty ? (
          <EmptyState
            icon="credit-card"
            title={t('money.emptyTitle')}
            message={t('money.emptyHint')}
          />
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {tile(t('money.incomes'), formatMoney(o.income, cur, { signed: true }), 'success', () =>
            router.push({
              pathname: '/money/history',
              params: { filter: 'income', offset: String(offset) },
            }),
          )}
          {tile(t('money.expenses'), formatMoney(-o.expense, cur), 'danger', () =>
            router.push({
              pathname: '/money/history',
              params: { filter: 'expense', offset: String(offset) },
            }),
          )}
          {tile(
            t('money.savings'),
            fmt(o.goals.reduce((s, g) => s + g.savedMinor, 0)),
            'text',
            () => router.push('/money/goals'),
          )}
          {tile(
            t('money.loans'),
            fmt(openLoans(o.loans, 'lent').reduce((s, l) => s + l.outstandingMinor, 0)),
            'warning',
            () => router.push('/money/loans'),
          )}
        </View>

        <SectionHeader
          title={
            o.unpaidTotal > 0
              ? t('money.dueTitleAmount', { amount: fmt(o.unpaidTotal) })
              : t('money.dueTitle')
          }
          action={{ label: t('money.manage'), onPress: () => router.push('/money/recurring') }}
        />
        {o.due.length === 0 ? (
          <Card>
            <ListRow
              title={t('money.addRecurring')}
              subtitle={t('money.addRecurringHint')}
              leading={<IconBadge icon="repeat" />}
              onPress={() => router.push('/money/recurring-form')}
            />
          </Card>
        ) : (
          <Card>
            {shownDue.map((d) => (
              <ListRow
                key={`${d.recurring.id}-${d.date}`}
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
                  router.push({ pathname: '/money/recurring-form', params: { id: d.recurring.id } })
                }
              />
            ))}
          </Card>
        )}

        {o.tontines.some((x) => x.payoutDate) ? (
          <Card>
            {o.tontines
              .filter((x) => x.payoutDate)
              .map((x) => (
                <ListRow
                  key={x.recurring.id}
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
              ))}
          </Card>
        ) : null}

        <SectionHeader
          title={t('money.recent')}
          action={
            o.items.length > 0
              ? {
                  label: t('common.seeAll'),
                  onPress: () =>
                    router.push({ pathname: '/money/history', params: { offset: String(offset) } }),
                }
              : undefined
          }
        />
        {o.items.length === 0 ? (
          <AppText color="muted">{t('money.noItems')}</AppText>
        ) : (
          <Card>
            {o.items.slice(0, 8).map((item) => (
              <TransactionRow
                key={item.id}
                item={item}
                categories={input.categories}
                lang={labels.lang}
                showDate
              />
            ))}
          </Card>
        )}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab accessibilityLabel={t('money.addExpense')} onPress={() => router.push('/money/add')} />
    </View>
  );
}
