import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { recurringWhen, remindersText } from '@/components/money/recurringText';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  formatMoney,
  listCategories,
  listRecurring,
  occurrencesBetween,
  type Recurring,
} from '@/modules/finance';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, ListRow, SectionHeader } from '@/shared/ui';

/** Charges fixes et tontines : ce qui revient chaque mois ou chaque semaine. */
export default function RecurringScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const list = useLiveQuery(listRecurring, ['money_recurring'], []);
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
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
  const monthly = charges
    .filter((r) => r.active)
    .reduce(
      (s, r) =>
        s + (r.frequency === 'weekly' ? Math.round((r.amountMinor * 52) / 12) : r.amountMinor),
      0,
    );

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.recurringTitle') }} />
      <AppText color="muted">{t('money.recurringIntro')}</AppText>
      <SectionHeader title={t('money.charges')} />
      {charges.length > 0 ? (
        <>
          <Card>{charges.map(row)}</Card>
          <AppText color="muted">
            {t('money.monthlyCharges', {
              amount: formatMoney(monthly, charges[0]?.currency ?? 'XAF'),
            })}
          </AppText>
        </>
      ) : (
        <AppText color="muted">{t('money.noCharges')}</AppText>
      )}
      <Button
        variant="secondary"
        label={t('money.addCharge')}
        onPress={() =>
          router.push({ pathname: '/money/recurring-form', params: { kind: 'charge' } })
        }
      />
      <SectionHeader title={t('money.tontines')} />
      {tontines.length > 0 ? (
        <Card>{tontines.map(row)}</Card>
      ) : (
        <AppText color="muted">{t('money.noTontines')}</AppText>
      )}
      <Button
        variant="secondary"
        label={t('money.addTontine')}
        onPress={() =>
          router.push({ pathname: '/money/recurring-form', params: { kind: 'tontine' } })
        }
      />
    </ScrollView>
  );
}
