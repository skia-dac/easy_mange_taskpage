import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { listOffPeriods } from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';
import { formatDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { Button, Card, Chip, EmptyState, IconBadge, ListRow, TextButton } from '@/shared/ui';

export default function OffPeriodsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const periods = useLiveQuery(listOffPeriods, ['off_periods'], []);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: t('offPeriods.title'),
          headerRight: () => (
            <TextButton label={t('common.add')} onPress={() => router.push('/off-periods/form')} />
          ),
        }}
      />
      {!periods.loading && (periods.data ?? []).length === 0 ? (
        <>
          <EmptyState
            icon="sun"
            title={t('offPeriods.empty')}
            message={t('offPeriods.emptyHint')}
          />
          <Button label={t('offPeriods.new')} onPress={() => router.push('/off-periods/form')} />
        </>
      ) : null}
      {(periods.data ?? []).length > 0 ? (
        <Card>
          {(periods.data ?? []).map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={
                p.startDate === p.endDate
                  ? formatDate(p.startDate, labels.lang)
                  : t('timetables.period', {
                      from: formatDate(p.startDate, labels.lang),
                      until: formatDate(p.endDate, labels.lang),
                    })
              }
              leading={
                <IconBadge
                  icon={p.kind === 'holiday' ? 'sun' : 'flag'}
                  color="warning"
                  background="warningSoft"
                />
              }
              trailing={
                <Chip
                  label={
                    p.suspendCourses ? t('offPeriods.suspended') : t('offPeriods.notSuspended')
                  }
                  tone={p.suspendCourses ? 'warning' : 'muted'}
                />
              }
              onPress={() => router.push({ pathname: '/off-periods/form', params: { id: p.id } })}
            />
          ))}
        </Card>
      ) : null}
    </ScrollView>
  );
}
