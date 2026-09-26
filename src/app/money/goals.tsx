import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { formatMoney, setGoalArchived, type Goal } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  showError,
  TextButton,
} from '@/shared/ui';

/** Fiche d'un objectif ; un objectif atteint peut être archivé (rangé à part, réversible). */
function GoalCard({
  goal,
  savedMinor,
  archived,
}: {
  goal: Goal;
  savedMinor: number;
  archived: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing, radius } = useTheme();
  const pct = Math.min(1, savedMinor / goal.targetMinor);
  const reached = pct >= 1;
  const toggleArchive = (value: boolean) =>
    setGoalArchived(db, goal.id, value).catch((e: unknown) => showError(userMessageKey(e)));

  return (
    <Card>
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
          {archived ? null : (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/money/goal-form', params: { id: goal.id } })}
            />
          )}
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
          {reached
            ? t('money.goalReached')
            : t('money.goalMissing', {
                amount: formatMoney(goal.targetMinor - savedMinor, goal.currency),
              })}
          {goal.deadline
            ? ` · ${t('money.goalDeadline', { date: formatShortDate(goal.deadline, labels.lang) })}`
            : ''}
        </AppText>
        {archived ? (
          <Button
            variant="secondary"
            label={t('money.unarchiveGoal')}
            onPress={() => void toggleArchive(false)}
          />
        ) : (
          <>
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
            {reached ? (
              <Button
                variant="secondary"
                label={t('money.archiveGoal')}
                onPress={() => void toggleArchive(true)}
              />
            ) : null}
          </>
        )}
      </View>
    </Card>
  );
}

/** Objectifs d'épargne : combien est mis de côté, combien il manque. Archivés repliés en bas. */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const data = useMoneyData(0);
  const [showArchived, setShowArchived] = useState(false);
  if (data.error) return <EmptyState icon="alert-circle" title={t('errors.loadFailed')} />;
  if (!data.data) return <LoadingScreen />;
  const { goals, archivedGoals } = data.data.overview;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.goalsTitle') }} />
      <AppText color="muted">{t('money.goalsIntro')}</AppText>
      {goals.length === 0 ? (
        <EmptyState icon="target" title={t('money.noGoals')} message={t('money.noGoalsHint')} />
      ) : null}
      {goals.map(({ goal, savedMinor }) => (
        <GoalCard key={goal.id} goal={goal} savedMinor={savedMinor} archived={false} />
      ))}
      <Button
        variant="secondary"
        label={t('money.newGoal')}
        onPress={() => router.push('/money/goal-form')}
      />
      {archivedGoals.length > 0 ? (
        <>
          <SectionHeader title={t('money.archivedGoals', { count: archivedGoals.length })} />
          <TextButton
            label={showArchived ? t('money.hideArchivedGoals') : t('money.showArchivedGoals')}
            onPress={() => setShowArchived((v) => !v)}
          />
          {showArchived
            ? archivedGoals.map(({ goal, savedMinor }) => (
                <GoalCard key={goal.id} goal={goal} savedMinor={savedMinor} archived />
              ))
            : null}
        </>
      ) : null}
    </ScrollView>
  );
}
