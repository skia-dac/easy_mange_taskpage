import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatMoney } from '@/modules/finance';
import { moneyHero, type MoneyOverview } from '@/projections';
import type { IsoDate } from '@/shared/dates';
import { useTheme } from '@/shared/theme';
import { AppText, Button, CountUpText } from '@/shared/ui';

const LABELS = { current: 'money.left', past: 'money.leftAtEnd', future: 'money.leftPlanned' };
const DEFICITS = {
  current: 'money.deficitNow',
  past: 'money.deficitPast',
  future: 'money.deficitFuture',
};

/**
 * Carte principale de l'onglet Argent : le solde de la période, ce qu'on peut dépenser par jour,
 * le report et les deux boutons de saisie. Solde négatif : la carte passe au ton « attention »
 * (orangé, jamais rouge) et dit clairement de combien on est à découvert.
 */
export function MoneyHero({ overview: o, today }: { overview: MoneyOverview; today: IsoDate }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const hero = moneyHero(o, today);
  const cur = o.currency;
  const fmt = (v: number) => formatMoney(v, cur);
  const deficit = hero.deficitMinor > 0;
  const fg = deficit ? 'text' : 'onPrimary';
  const current = hero.tense === 'current';

  return (
    <View
      testID={deficit ? 'money-hero-deficit' : 'money-hero'}
      style={{
        backgroundColor: deficit ? colors.warningSoft : colors.primary,
        borderRadius: radius.xl,
        borderWidth: deficit ? 1.5 : 0,
        borderColor: colors.warning,
        padding: spacing.xl,
        gap: spacing.sm,
      }}
    >
      <AppText variant="label" color={fg} style={{ letterSpacing: 1 }}>
        {t(LABELS[hero.tense]).toLocaleUpperCase()}
      </AppText>
      <CountUpText
        variant="display"
        color={deficit ? 'warning' : 'onPrimary'}
        value={o.balance}
        format={(n) => formatMoney(n, cur)}
      />
      {deficit ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <Feather
            name="alert-triangle"
            size={18}
            color={colors.warning}
            style={{ marginTop: 2 }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong" color="text">
              {t(DEFICITS[hero.tense], { amount: fmt(hero.deficitMinor) })}
            </AppText>
            {current ? <AppText color="text">{t('money.deficitHint')}</AppText> : null}
          </View>
        </View>
      ) : null}
      {hero.bar ? (
        <View style={{ gap: spacing.xs }}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('money.leftBar')}
            accessibilityValue={{
              min: 0,
              max: 100,
              now: hero.bar.leftPercent,
              text: t('money.leftBarCaption', {
                percent: hero.bar.leftPercent,
                available: fmt(hero.bar.availableMinor),
              }),
            }}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primarySoft,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${hero.bar.leftPercent}%`,
                height: 8,
                // Remplissage foncé sur rail clair : il se voit (≥ 3:1), en clair comme en sombre.
                backgroundColor: colors.text,
              }}
            />
          </View>
          <AppText
            variant="caption"
            color="onPrimary"
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {t('money.leftBarCaption', {
              percent: hero.bar.leftPercent,
              available: fmt(hero.bar.availableMinor),
            })}
          </AppText>
        </View>
      ) : null}
      {current && !deficit ? (
        <AppText color="onPrimary">
          {o.unpaidTotal > 0
            ? t('money.afterCharges', { amount: fmt(o.afterCharges), perDay: fmt(o.perDay) })
            : t('money.perDay', { perDay: fmt(o.perDay), days: o.daysLeft })}
        </AppText>
      ) : null}
      {hero.carryOverMinor !== null ? (
        <AppText variant="caption" color={fg}>
          {t('money.carryOver', {
            amount: formatMoney(hero.carryOverMinor, cur, { signed: true }),
          })}
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
  );
}
