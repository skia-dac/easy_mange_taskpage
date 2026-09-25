import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import { colorOf } from '@/modules/academic';
import {
  DEFAULT_WORK_WEEK_HOURS,
  getRotationAnchor,
  getWorkWeekHours,
  setRotationAnchor,
} from '@/modules/identity';
import {
  copyWeekInputs,
  createPersonalEvent,
  isOvernight,
  listPersonalEvents,
  listSlots,
  rotationOf,
  slotMinutes,
} from '@/modules/productivity';
import { useAgendaData, workWeek } from '@/projections';
import { addDaysIso, startOfWeekOn, toIsoDate, weekdayOrder } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDuration } from '@/shared/format';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  confirmAction,
  EmptyState,
  IconBadge,
  ListRow,
  SectionHeader,
  Segmented,
  showError,
  showInfo,
  SubjectDot,
} from '@/shared/ui';

/**
 * « Mon planning » : la semaine type (créneaux fixes, chaque semaine ou semaine A / B), la
 * rotation en cours, les heures de la semaine et « Copier la semaine dernière ».
 */
export default function PlanningScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const weekStart = useWeekStart();
  const spaces = useSpaces();
  const today = toIsoDate(new Date());
  const thisWeek = startOfWeekOn(today, weekStart);
  const slots = useLiveQuery(listSlots, ['work_slots'], []);
  const anchor = useLiveQuery(getRotationAnchor, ['app_settings'], []);
  const hours = useLiveQuery(getWorkWeekHours, ['app_settings'], []);
  const agenda = useAgendaData();
  const [copying, setCopying] = useState(false);

  const current = anchor.data ? rotationOf(today, anchor.data, weekStart) : 'A';
  const hasRotation = (slots.data ?? []).some((s) => s.rotation !== 'every');
  const week = agenda.data
    ? workWeek(agenda.data, thisWeek, hours.data ?? DEFAULT_WORK_WEEK_HOURS)
    : null;
  const copySpace = spaces.has('work') ? 'work' : 'personal';

  const setCurrent = (value: 'A' | 'B') =>
    void setRotationAnchor(db, value === 'A' ? thisWeek : addDaysIso(thisWeek, -7)).catch(
      (e: unknown) => showError(userMessageKey(e)),
    );

  const copyLastWeek = async () => {
    const events = await listPersonalEvents(db);
    const inputs = copyWeekInputs(events, addDaysIso(thisWeek, -7), copySpace);
    if (inputs.length === 0) {
      showInfo(t('planning.copyTitle'), t('planning.copyNothing'));
      return;
    }
    const ok = await confirmAction(
      t('planning.copyTitle'),
      t('planning.copyConfirm', { count: inputs.length }),
      t('planning.copyButton'),
    );
    if (!ok) return;
    setCopying(true);
    try {
      for (const input of inputs) await createPersonalEvent(db, input);
      showInfo(t('planning.copyTitle'), t('planning.copyDone', { count: inputs.length }));
    } catch (e) {
      showError(userMessageKey(e));
    } finally {
      setCopying(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('planning.title') }} />
      <AppText color="muted">{t('planning.intro')}</AppText>

      {week ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge icon="clock" />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">
                {t('glance.planOf', {
                  planned: formatDuration(week.plannedMinutes),
                  target: formatDuration(week.targetMinutes),
                })}
              </AppText>
              <AppText variant="caption" color="muted">
                {week.toPlanMinutes > 0
                  ? t('planning.toPlan', { duration: formatDuration(week.toPlanMinutes) })
                  : t('glance.planFull')}
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <SectionHeader title={t('planning.rotationTitle')} />
      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong">{t('planning.thisWeekIs')}</AppText>
          <Segmented
            value={current}
            onChange={setCurrent}
            options={[
              { value: 'A', label: t('planning.weekA') },
              { value: 'B', label: t('planning.weekB') },
            ]}
          />
          <AppText variant="caption" color="muted">
            {hasRotation ? t('planning.rotationHint') : t('planning.rotationNone')}
          </AppText>
        </View>
      </Card>

      <SectionHeader
        title={t('planning.weekType')}
        action={{ label: t('common.add'), onPress: () => router.push('/planning/slot-form') }}
      />
      {(slots.data ?? []).length === 0 && !slots.loading ? (
        <EmptyState icon="repeat" title={t('planning.empty')} message={t('planning.emptyHint')} />
      ) : (
        weekdayOrder(weekStart).map((d) => {
          const day = (slots.data ?? []).filter((s) => s.weekdays.includes(d));
          if (day.length === 0) return null;
          return (
            <View key={d} style={{ gap: spacing.xs }}>
              <AppText variant="label" color="muted">
                {labels.weekday(d).toLocaleUpperCase()}
              </AppText>
              <Card>
                {day.map((s) => (
                  <ListRow
                    key={s.id}
                    title={s.title}
                    subtitle={[
                      `${s.startTime} – ${s.endTime}${isOvernight(s) ? ` (${t('planning.nextDay')})` : ''}`,
                      formatDuration(slotMinutes(s)),
                      s.location,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    leading={<SubjectDot color={colorOf({ colorId: s.colorId })} size={14} />}
                    trailing={
                      s.rotation === 'every' ? undefined : (
                        <Chip
                          label={s.rotation === 'A' ? t('planning.weekA') : t('planning.weekB')}
                          tone={s.rotation === current ? 'primary' : 'muted'}
                        />
                      )
                    }
                    onPress={() =>
                      router.push({ pathname: '/planning/slot-form', params: { id: s.id } })
                    }
                  />
                ))}
              </Card>
            </View>
          );
        })
      )}
      <Button label={t('planning.newSlot')} onPress={() => router.push('/planning/slot-form')} />

      <SectionHeader title={t('planning.copyTitle')} />
      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText color="muted">{t('planning.copyHint')}</AppText>
          <Button
            variant="secondary"
            label={t('planning.copyButton')}
            disabled={copying}
            onPress={() => void copyLastWeek()}
          />
        </View>
      </Card>
    </ScrollView>
  );
}
