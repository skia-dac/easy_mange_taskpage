import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  activeTimetable,
  colorOf,
  listCourseSeries,
  listTimetables,
  type CourseSeries,
} from '@/modules/academic';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  IconBadge,
  ListRow,
  SectionHeader,
  SubjectBar,
  TextButton,
} from '@/shared/ui';

export default function TimetablesScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const { byId } = useSubjects();
  const timetables = useLiveQuery(listTimetables, ['timetables'], []);
  const series = useLiveQuery((db) => listCourseSeries(db), ['course_series'], []);
  const active = activeTimetable(timetables.data ?? [], toIsoDate(new Date()));

  const courseRow = (c: CourseSeries) => {
    const subject = byId.get(c.subjectId);
    return (
      <ListRow
        key={c.id}
        title={c.title ?? subject?.name ?? ''}
        subtitle={[
          c.recurrence === 'weekly'
            ? labels.weekday(c.weekday)
            : formatDate(c.validFrom, labels.lang),
          `${c.startTime} – ${c.endTime}`,
          labels.courseType(c.courseType),
          c.room,
        ]
          .filter(Boolean)
          .join(' · ')}
        leading={<SubjectBar color={colorOf(subject)} />}
        onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id } })}
      />
    );
  };

  const withoutTimetable = (series.data ?? []).filter((c) => !c.timetableId);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl * 2,
      }}
    >
      <Stack.Screen
        options={{
          title: t('timetables.title'),
          headerRight: () => (
            <TextButton label={t('common.add')} onPress={() => router.push('/timetables/form')} />
          ),
        }}
      />
      {!timetables.loading && (timetables.data ?? []).length === 0 ? (
        <>
          <EmptyState
            icon="calendar"
            title={t('timetables.empty')}
            message={t('timetables.emptyHint')}
          />
          <Button label={t('timetables.new')} onPress={() => router.push('/timetables/form')} />
        </>
      ) : null}

      {(timetables.data ?? []).map((tt) => {
        const courses = (series.data ?? []).filter((c) => c.timetableId === tt.id);
        return (
          <View key={tt.id} style={{ gap: spacing.sm }}>
            <SectionHeader
              title={tt.name}
              action={{
                label: t('common.edit'),
                onPress: () => router.push({ pathname: '/timetables/form', params: { id: tt.id } }),
              }}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <AppText color="muted">
                {t('timetables.period', {
                  from: formatDate(tt.validFrom, labels.lang),
                  until: formatDate(tt.validUntil, labels.lang),
                })}
              </AppText>
              {active?.id === tt.id ? <Chip label={t('timetables.active')} tone="success" /> : null}
            </View>
            <Card>
              {courses.length === 0 ? (
                <AppText color="muted">{t('timetables.noCourses')}</AppText>
              ) : null}
              {courses.map(courseRow)}
              <TextButton
                label={`+ ${t('timetables.addCourse')}`}
                onPress={() =>
                  router.push({ pathname: '/courses/form', params: { timetableId: tt.id } })
                }
              />
            </Card>
          </View>
        );
      })}

      <Card>
        <ListRow
          title={t('offPeriods.title')}
          subtitle={t('offPeriods.emptyHint')}
          leading={<IconBadge icon="sun" color="warning" background="warningSoft" />}
          onPress={() => router.push('/off-periods')}
        />
      </Card>

      {withoutTimetable.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('timetables.otherCourses')} />
          <Card>{withoutTimetable.map(courseRow)}</Card>
        </View>
      ) : null}
    </ScrollView>
  );
}
