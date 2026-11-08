import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';

import { TransactionRow } from '@/components/money/TransactionRow';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney, isInflow, type Transaction } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { fromIsoDate } from '@/shared/dates';
import { formatLongDate, formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  CardSegment,
  cardPosition,
  EmptyState,
  ListItemMotion,
  loadStateOf,
  SectionHeader,
  Segmented,
  StateView,
  TextButton,
  type CardPosition,
} from '@/shared/ui';

type Filter = 'all' | 'expense' | 'income';

/** Lignes (titres de jour compris) affichées d'un coup ; la suite vient en descendant. */
export const HISTORY_PAGE = 60;

type Entry =
  | { kind: 'day'; key: string; date: string; total: number }
  | { kind: 'item'; key: string; item: Transaction; pos: CardPosition };

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
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const data = useMoneyData(offset);
  const state = loadStateOf(data);
  const entries = useMemo(() => {
    const items = (data.data?.overview.items ?? []).filter((i) =>
      filter === 'all' ? true : filter === 'income' ? isInflow(i.kind) : !isInflow(i.kind),
    );
    const map = new Map<string, Transaction[]>();
    for (const i of items) map.set(i.date, [...(map.get(i.date) ?? []), i]);
    const out: Entry[] = [];
    for (const [date, dayItems] of map) {
      const total = dayItems.reduce(
        (s, i) => s + (isInflow(i.kind) ? i.amountMinor : -i.amountMinor),
        0,
      );
      out.push({ kind: 'day', key: `d:${date}`, date, total });
      dayItems.forEach((item, i) =>
        out.push({ kind: 'item', key: item.id, item, pos: cardPosition(i, dayItems.length) }),
      );
    }
    return out;
  }, [data.data, filter]);

  // Autre période ou autre filtre : on repart de la première page.
  const changePeriod = (next: number) => {
    setOffset(next);
    setLimit(HISTORY_PAGE);
  };
  const changeFilter = (next: Filter) => {
    setFilter(next);
    setLimit(HISTORY_PAGE);
  };

  const o = data.data?.overview;
  const shown = entries.slice(0, limit);
  const more = entries.length > limit;

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextButton label={`‹ ${t('money.previous')}`} onPress={() => changePeriod(offset - 1)} />
        {o ? (
          <AppText variant="bodyStrong">
            {t('money.periodRange', {
              from: formatShortDate(o.range.from, labels.lang),
              to: formatShortDate(o.range.to, labels.lang),
            })}
          </AppText>
        ) : null}
        <TextButton label={`${t('money.next')} ›`} onPress={() => changePeriod(offset + 1)} />
      </View>
      <Segmented
        accessibilityLabel={t('money.filterLabel')}
        value={filter}
        onChange={changeFilter}
        options={[
          { value: 'all', label: t('money.all') },
          { value: 'expense', label: t('money.expenses') },
          { value: 'income', label: t('money.incomes') },
        ]}
      />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('money.history') }} />
      <FlatList
        data={state === 'ready' ? shown : []}
        keyExtractor={(e) => e.key}
        initialNumToRender={14}
        windowSize={9}
        contentContainerStyle={{ padding: spacing.xl }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ marginTop: spacing.lg }}>
            {state !== 'ready' ? (
              <StateView state={state} onRetry={data.retry} />
            ) : (
              <EmptyState icon="list" title={t('money.noItems')} />
            )}
          </View>
        }
        ListFooterComponent={
          more ? (
            <View style={{ marginTop: spacing.lg }}>
              <TextButton
                label={t('common.showMore', {
                  count: Math.min(entries.length - limit, HISTORY_PAGE),
                })}
                onPress={() => setLimit((n) => n + HISTORY_PAGE)}
              />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (more) setLimit((n) => n + HISTORY_PAGE);
        }}
        onEndReachedThreshold={0.5}
        renderItem={({ item: e, index }) =>
          e.kind === 'day' ? (
            <View style={{ marginTop: spacing.lg }}>
              <ListItemMotion index={index}>
                <SectionHeader
                  title={`${formatLongDate(fromIsoDate(e.date), labels.lang)} · ${formatMoney(e.total, o?.currency ?? '', { signed: true })}`}
                />
              </ListItemMotion>
            </View>
          ) : (
            <View style={{ marginTop: e.pos === 'first' || e.pos === 'only' ? spacing.sm : 0 }}>
              <ListItemMotion index={index}>
                <CardSegment position={e.pos}>
                  <TransactionRow
                    item={e.item}
                    categories={data.data?.input.categories ?? []}
                    lang={labels.lang}
                  />
                </CardSegment>
              </ListItemMotion>
            </View>
          )
        }
      />
    </>
  );
}
