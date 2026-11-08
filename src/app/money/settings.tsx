import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  categoryKinds,
  currencies,
  currencyCodes,
  defaultMoneyPrefs,
  getMoneyPrefs,
  listCategories,
  periodContaining,
  setMoneyPrefs,
  type MoneyPrefs,
} from '@/modules/finance';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  ChoiceChips,
  DayOfMonthPicker,
  ListRow,
  SectionHeader,
  Segmented,
  SelectField,
  showError,
  Tappable,
  Toggle,
} from '@/shared/ui';

/** Réglages de l'argent : monnaie, début du mois ou de la semaine, widgets, catégories personnelles. */
export default function MoneySettingsScreen() {
  const { t, i18n } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const prefsQ = useLiveQuery(getMoneyPrefs, ['app_settings'], []);
  const prefs = prefsQ.data ?? defaultMoneyPrefs;
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
  const money = useMoneyLabels(cats.data ?? []);
  const custom = cats.data ?? [];
  const fail = (e: unknown) => showError(userMessageKey(e));
  const openCategory = (id?: string) =>
    router.push(id ? { pathname: '/money/category-form', params: { id } } : '/money/category-form');

  const save = (patch: Partial<MoneyPrefs>) =>
    setMoneyPrefs(db, { ...prefs, ...patch }).catch(fail);
  const period = prefs.period;
  const currentPeriod = periodContaining(toIsoDate(new Date()), period);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl + insets.bottom,
      }}
    >
      <Stack.Screen options={{ title: t('money.settings') }} />

      <SectionHeader title={t('money.currency')} />
      <SelectField
        label={t('money.currency')}
        value={prefs.currency}
        options={currencyCodes.map((c) => ({
          value: c,
          label: `${t(`money.currencies.${c}`)} (${currencies[c].symbol})`,
        }))}
        onChange={(v) => v && void save({ currency: v as MoneyPrefs['currency'] })}
      />
      <AppText variant="caption" color="muted">
        {t('money.currencyHint')}
      </AppText>

      <SectionHeader title={t('money.periodTitle')} />
      <Segmented
        accessibilityLabel={t('money.periodTitle')}
        value={period.kind}
        onChange={(k) =>
          void save({
            period:
              k === 'month' ? { kind: 'month', startDay: 1 } : { kind: 'week', startWeekday: 1 },
          })
        }
        options={[
          { value: 'month', label: t('money.periodMonth') },
          { value: 'week', label: t('money.periodWeek') },
        ]}
      />
      {period.kind === 'month' ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="bodyStrong">{t('money.periodStartDay')}</AppText>
            <DayOfMonthPicker
              accessibilityLabel={t('money.periodStartDay')}
              value={period.startDay}
              dayLabel={(day) => t('money.dayN', { day })}
              onChange={(day) => void save({ period: { kind: 'month', startDay: day } })}
            />
          </View>
        </Card>
      ) : (
        <ChoiceChips
          label={t('money.periodStartWeekday')}
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
            value: n,
            label: labels.weekday(n, 'short'),
          }))}
          selected={[period.startWeekday]}
          onToggle={(n) => void save({ period: { kind: 'week', startWeekday: n } })}
        />
      )}
      <AppText variant="caption" color="muted">
        {t('money.periodCurrent', {
          from: formatShortDate(currentPeriod.from, i18n.language),
          to: formatShortDate(currentPeriod.to, i18n.language),
        })}{' '}
        {t('money.periodHint')}
      </AppText>

      <SectionHeader title={t('money.widgets')} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">{t('money.hideAmounts')}</AppText>
            <AppText variant="caption" color="muted">
              {t('money.hideAmountsHint')}
            </AppText>
          </View>
          <Toggle
            accessibilityLabel={t('money.hideAmounts')}
            value={prefs.hideWidgetAmounts}
            onValueChange={(v) => void save({ hideWidgetAmounts: v })}
          />
        </View>
      </Card>

      <SectionHeader title={t('money.myCategories')} />
      {custom.length === 0 ? (
        <AppText color="muted">{t('money.noCustomCategories')}</AppText>
      ) : null}
      <Card>
        {categoryKinds.map((kind) => {
          const list = custom.filter((c) => c.kind === kind);
          if (list.length === 0) return null;
          return (
            <View key={kind}>
              <AppText
                variant="caption"
                color="muted"
                accessibilityRole="header"
                style={{ marginTop: spacing.xs }}
              >
                {kind === 'income' ? t('money.incomes') : t('money.expenses')}
              </AppText>
              {list.map((c) => (
                <ListRow
                  key={c.id}
                  title={money.categoryName(c)}
                  leading={<CategoryBadge category={c} />}
                  onPress={() => openCategory(c.id)}
                />
              ))}
            </View>
          );
        })}
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t('money.newCategory')}
          onPress={() => openCategory()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: minTouchSize + 8,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 40 * 0.32,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="plus" size={20} color={colors.primary} />
          </View>
          <AppText variant="bodyStrong" color="primary">
            {t('money.newCategory')}
          </AppText>
        </Tappable>
      </Card>
    </ScrollView>
  );
}
