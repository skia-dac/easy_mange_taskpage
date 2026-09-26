import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLabels } from '@/hooks/useLabels';
import { listOffPeriods } from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';
import { formatDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Fab,
  FAB_CLEARANCE,
  IconBadge,
  ListRow,
} from '@/shared/ui';

export default function OffPeriodsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const periods = useLiveQuery(listOffPeriods, ['off_periods'], []);

  const add = () => router.push('/off-periods/form');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
        }}
      >
        <Stack.Screen options={{ title: t('offPeriods.title') }} />
        {!periods.loading && (periods.data ?? []).length === 0 ? (
          <>
            <EmptyState
              icon="sun"
              title={t('offPeriods.empty')}
              message={t('offPeriods.emptyHint')}
            />
            <Button label={t('offPeriods.new')} onPress={add} />
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
      <Fab accessibilityLabel={t('offPeriods.new')} onPress={add} />
    </View>
  );
}
