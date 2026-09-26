import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { formatMoney } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Card, CountUpText, IconBadge } from '@/shared/ui';

/** Carte d'Aujourd'hui : ce qui est dépensé aujourd'hui, ce qu'on peut encore dépenser, et un « + ». */
export function TodayMoneyCard() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const data = useMoneyData(0);
  const o = data.data?.overview;
  if (!o) return null;
  const started = o.items.length > 0 || o.carryOver !== 0;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge icon="credit-card" color="success" background="successSoft" />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/(tabs)/money')}
          style={{ flex: 1, gap: 2 }}
        >
          {started ? (
            <CountUpText
              variant="bodyStrong"
              value={o.todaySpent}
              format={(n) => t('money.todaySpent', { amount: formatMoney(n, o.currency) })}
            />
          ) : (
            <AppText variant="bodyStrong">{t('money.todayStart')}</AppText>
          )}
          {started ? (
            <CountUpText
              variant="caption"
              color="muted"
              value={o.perDay}
              format={(n) => t('money.todayPerDay', { amount: formatMoney(n, o.currency) })}
            />
          ) : (
            <AppText variant="caption" color="muted">
              {t('money.todayStartHint')}
            </AppText>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('money.addExpense')}
          onPress={() => router.push({ pathname: '/money/add', params: { kind: 'expense' } })}
          style={({ pressed }) => ({
            width: minTouchSize,
            height: minTouchSize,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Feather name="plus" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>
    </Card>
  );
}
