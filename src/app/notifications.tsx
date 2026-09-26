import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useSubjects } from '@/hooks/useSubjects';
import { getNotificationPreferences, type NotificationPreferences } from '@/modules/identity';
import {
  hasPermission,
  HORIZON_DAYS,
  planReminders,
  readableParams,
  routeForResponse,
  type PlannedReminder,
} from '@/modules/platform';
import { useAgendaData } from '@/projections';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatLongDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  EmptyState,
  IconBadge,
  ListRow,
  SectionHeader,
  TextButton,
} from '@/shared/ui';

const iconFor = (r: PlannedReminder) =>
  r.action.kind === 'course'
    ? 'clock'
    : r.action.kind === 'endOfCourse'
      ? 'check-circle'
      : r.action.kind === 'exam'
        ? 'award'
        : r.action.kind === 'event'
          ? 'star'
          : 'book';

/** Rappels à venir (§26 des écrans) : ce que le téléphone va afficher, dans l'ordre. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const agenda = useAgendaData();
  const { byId } = useSubjects();
  const prefs = useLiveQuery(getNotificationPreferences, ['app_settings'], []);
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void hasPermission().then(setGranted);
  }, []);

  const plan = useMemo(() => {
    if (!agenda.data || !prefs.data) return [];
    const p: NotificationPreferences = prefs.data;
    return planReminders(agenda.data, p, new Date(), {
      subjectName: (id) => byId.get(id)?.name ?? '',
    });
  }, [agenda.data, prefs.data, byId]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannedReminder[]>();
    for (const r of plan) {
      const day = toIsoDate(r.fireAt);
      map.set(day, [...(map.get(day) ?? []), r]);
    }
    return [...map.entries()];
  }, [plan]);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.md,
        paddingBottom: spacing.xxl * 2,
      }}
    >
      <Stack.Screen
        options={{
          title: t('notifications.title'),
          headerRight: () => (
            <TextButton
              label={t('notifications.settings')}
              onPress={() => router.push('/settings')}
            />
          ),
        }}
      />
      {granted === false ? (
        <Card>
          <AppText>{t('notifications.off')}</AppText>
          <TextButton
            label={t('notifications.settings')}
            onPress={() => router.push('/settings')}
          />
        </Card>
      ) : null}
      {plan.length === 0 && !agenda.loading ? (
        <EmptyState
          icon="bell"
          title={t('notifications.empty')}
          message={t('notifications.emptyHint')}
        />
      ) : (
        <AppText color="muted">
          {t('notifications.count', { count: plan.length, days: HORIZON_DAYS })}
        </AppText>
      )}
      {byDay.map(([day, items]) => (
        <View key={day} style={{ gap: spacing.sm }}>
          <SectionHeader title={formatLongDate(new Date(`${day}T12:00:00`), i18n.language)} />
          <Card>
            {items.map((r) => (
              <ListRow
                key={r.id}
                title={t(r.title.key, r.title.params)}
                subtitle={t(r.body.key, readableParams(r.body.params))}
                leading={<IconBadge icon={iconFor(r)} />}
                trailing={
                  <AppText variant="bodyStrong">{`${String(r.fireAt.getHours()).padStart(2, '0')}:${String(r.fireAt.getMinutes()).padStart(2, '0')}`}</AppText>
                }
                onPress={() => {
                  const href = routeForResponse({ actionIdentifier: '', action: r.action });
                  if (href) router.push(href);
                }}
              />
            ))}
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}
