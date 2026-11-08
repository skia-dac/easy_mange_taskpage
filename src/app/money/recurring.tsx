import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { recurringWhen, remindersText } from '@/components/money/recurringText';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  formatMoney,
  getMoneyPrefs,
  listCategories,
  listRecurring,
  monthlyChargesTotal,
  occurrencesBetween,
  type Recurring,
} from '@/modules/finance';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { settingTable, useLiveQuery } from '@/shared/db';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceSheet,
  Fab,
  FAB_CLEARANCE,
  ListRow,
  SectionHeader,
} from '@/shared/ui';

/**
 * Charges fixes et tontines : ce qui revient chaque mois ou chaque semaine. `highlight` (rappel
 * touché) : la ligne est mise en avant et amenée à l'écran.
 */
export default function RecurringScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, radius, spacing } = useTheme();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const scroll = useRef<ScrollView>(null);
  // Position de la ligne mise en avant : celle de sa carte dans la liste, plus la sienne dedans.
  const [cardY, setCardY] = useState<Record<string, number>>({});
  const [rowY, setRowY] = useState<{ card: string; y: number } | null>(null);
  const target = rowY ? (cardY[rowY.card] ?? null) : null;
  useEffect(() => {
    if (rowY && target !== null)
      scroll.current?.scrollTo({ y: Math.max(0, target + rowY.y - spacing.xl), animated: false });
  }, [rowY, target, spacing.xl]);
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const add = (kind: Recurring['kind']) =>
    router.push({ pathname: '/money/recurring-form', params: { kind } });
  const list = useLiveQuery(listRecurring, ['money_recurring'], []);
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
  const prefs = useLiveQuery(getMoneyPrefs, [settingTable('money_prefs')], []);
  const money = useMoneyLabels(cats.data ?? []);
  const today = toIsoDate(new Date());
  const all = list.data ?? [];

  const row = (r: Recurring) => {
    const next = occurrencesBetween(r, today, addDaysIso(today, 62))[0];
    const lit = r.id === highlight;
    const line = (
      <ListRow
        key={r.id}
        title={r.name}
        struck={!r.active}
        subtitle={[
          recurringWhen(r, t, labels.weekday),
          next ? t('money.nextOn', { date: formatShortDate(next, labels.lang) }) : null,
          r.reminders.length ? `⏰ ${remindersText(r.reminders, t)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        leading={
          <CategoryBadge
            category={money.categoryOf(
              r.categoryId ?? (r.kind === 'tontine' ? 'tontine' : 'other'),
            )}
          />
        }
        trailing={
          <AppText variant="bodyStrong">
            {formatMoney(r.amountMinor, r.currency, { symbol: false })}
          </AppText>
        }
        onPress={() => router.push({ pathname: '/money/recurring-form', params: { id: r.id } })}
      />
    );
    if (!lit) return line;
    return (
      <View
        key={r.id}
        testID="recurring-highlight"
        onLayout={(e) => setRowY({ card: r.kind, y: e.nativeEvent.layout.y })}
        style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md }}
      >
        {line}
      </View>
    );
  };
  const card = (kind: Recurring['kind'], rows: Recurring[]) => (
    <View
      onLayout={(e) => {
        const y = e.nativeEvent.layout.y;
        setCardY((c) => (c[kind] === y ? c : { ...c, [kind]: y }));
      }}
    >
      <Card>{rows.map(row)}</Card>
    </View>
  );

  const charges = all.filter((r) => r.kind === 'charge');
  const tontines = all.filter((r) => r.kind === 'tontine');
  // Seulement la devise choisie : on n'additionne pas des francs et des euros.
  const currency = prefs.data?.currency ?? charges[0]?.currency ?? 'XAF';
  const monthly = monthlyChargesTotal(all, currency);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
        }}
      >
        <Stack.Screen options={{ title: t('money.recurringTitle') }} />
        <AppText color="muted">{t('money.recurringIntro')}</AppText>
        <SectionHeader title={t('money.charges')} />
        {charges.length > 0 ? (
          <>
            {card('charge', charges)}
            <AppText color="muted">
              {t('money.monthlyCharges', {
                amount: formatMoney(monthly, currency),
              })}
            </AppText>
          </>
        ) : list.loading ? null : (
          <>
            <AppText color="muted">{t('money.noCharges')}</AppText>
            <Button
              variant="secondary"
              label={t('money.addCharge')}
              onPress={() => add('charge')}
            />
          </>
        )}
        <SectionHeader title={t('money.tontines')} />
        {tontines.length > 0 ? (
          card('tontine', tontines)
        ) : list.loading ? null : (
          <>
            <AppText color="muted">{t('money.noTontines')}</AppText>
            <Button
              variant="secondary"
              label={t('money.addTontine')}
              onPress={() => add('tontine')}
            />
          </>
        )}
      </ScrollView>
      <Fab
        accessibilityLabel={t('money.addRecurringMenu')}
        menuOpen={menu}
        onPress={() => setMenu(true)}
      />
      <ChoiceSheet
        visible={menu}
        title={t('money.addRecurringMenu')}
        options={[
          { label: t('money.chargeOption'), afterDismiss: true, onPress: () => add('charge') },
          { label: t('money.tontineOption'), afterDismiss: true, onPress: () => add('tontine') },
        ]}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}
