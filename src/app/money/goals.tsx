import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { formatMoney } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, EmptyState, LoadingScreen, TextButton } from '@/shared/ui';

/** Objectifs d'épargne : combien est mis de côté, combien il manque. */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing, radius } = useTheme();
  const data = useMoneyData(0);
  if (data.error) return <EmptyState icon="alert-circle" title={t('errors.loadFailed')} />;
  if (!data.data) return <LoadingScreen />;
  const goals = data.data.overview.goals;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.goalsTitle') }} />
      <AppText color="muted">{t('money.goalsIntro')}</AppText>
      {goals.length === 0 ? (
        <EmptyState icon="target" title={t('money.noGoals')} message={t('money.noGoalsHint')} />
      ) : null}
      {goals.map(({ goal, savedMinor }) => {
        const pct = Math.min(1, savedMinor / goal.targetMinor);
        return (
          <Card key={goal.id}>
            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                }}
              >
                <AppText variant="heading" style={{ flex: 1 }}>
                  {goal.name}
                </AppText>
                <TextButton
                  label={t('common.edit')}
                  onPress={() =>
                    router.push({ pathname: '/money/goal-form', params: { id: goal.id } })
                  }
                />
              </View>
              <AppText variant="bodyStrong">
                {t('money.goalProgress', {
                  saved: formatMoney(savedMinor, goal.currency),
                  target: formatMoney(goal.targetMinor, goal.currency),
                })}
              </AppText>
              <View
                style={{
                  height: 10,
                  borderRadius: radius.sm,
                  backgroundColor: colors.background,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.round(pct * 100)}%`,
                    height: 10,
                    backgroundColor: colors.success,
                  }}
                />
              </View>
              <AppText variant="caption" color="muted">
                {pct >= 1
                  ? t('money.goalReached')
                  : t('money.goalMissing', {
                      amount: formatMoney(goal.targetMinor - savedMinor, goal.currency),
                    })}
                {goal.deadline
                  ? ` · ${t('money.goalDeadline', { date: formatShortDate(goal.deadline, labels.lang) })}`
                  : ''}
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={t('money.putAside')}
                    onPress={() =>
                      router.push({
                        pathname: '/money/add',
                        params: { kind: 'saving', goalId: goal.id },
                      })
                    }
                  />
                </View>
                {savedMinor > 0 ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="secondary"
                      label={t('money.takeBack')}
                      onPress={() =>
                        router.push({
                          pathname: '/money/add',
                          params: { kind: 'saving_back', goalId: goal.id },
                        })
                      }
                    />
                  </View>
                ) : null}
              </View>
            </View>
          </Card>
        );
      })}
      <Button
        variant="secondary"
        label={t('money.newGoal')}
        onPress={() => router.push('/money/goal-form')}
      />
    </ScrollView>
  );
}
