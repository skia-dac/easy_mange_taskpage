import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
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
import { useLiveQuery } from '@/shared/db';
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

/** Charges fixes et tontines : ce qui revient chaque mois ou chaque semaine. */
export default function RecurringScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const add = (kind: Recurring['kind']) =>
    router.push({ pathname: '/money/recurring-form', params: { kind } });
  const list = useLiveQuery(listRecurring, ['money_recurring'], []);
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
  const prefs = useLiveQuery(getMoneyPrefs, ['app_settings'], []);
  const money = useMoneyLabels(cats.data ?? []);
  const today = toIsoDate(new Date());
  const all = list.data ?? [];

  const row = (r: Recurring) => {
    const next = occurrencesBetween(r, today, addDaysIso(today, 62))[0];
    return (
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
  };

  const charges = all.filter((r) => r.kind === 'charge');
  const tontines = all.filter((r) => r.kind === 'tontine');
  // Seulement la devise choisie : on n'additionne pas des francs et des euros.
  const currency = prefs.data?.currency ?? charges[0]?.currency ?? 'XAF';
  const monthly = monthlyChargesTotal(all, currency);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
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
            <Card>{charges.map(row)}</Card>
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
          <Card>{tontines.map(row)}</Card>
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
      <Fab accessibilityLabel={t('money.addRecurringMenu')} onPress={() => setMenu(true)} />
      <ChoiceSheet
        visible={menu}
        title={t('money.addRecurringMenu')}
        options={[
          { label: t('money.chargeOption'), onPress: () => add('charge') },
          { label: t('money.tontineOption'), onPress: () => add('tontine') },
        ]}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}
