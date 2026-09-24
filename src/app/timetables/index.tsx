import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  activeTimetable,
  colorOf,
  listCourseSeries,
  listExams,
  listTimetables,
  timetableKinds,
  type CourseSeries,
  type Timetable,
} from '@/modules/academic';
import { listRevisionBlocks } from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDate, formatShortDate } from '@/shared/format';
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
  const exams = useLiveQuery(listExams, ['exams'], []);
  const blocks = useLiveQuery((db) => listRevisionBlocks(db), ['revision_blocks'], []);
  const today = toIsoDate(new Date());

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

  const active = (kind: Timetable['kind']) => activeTimetable(timetables.data ?? [], today, kind);

  const contents = (tt: Timetable) => {
    if (tt.kind === 'exams') {
      const list = (exams.data ?? []).filter((e) => e.timetableId === tt.id);
      return (
        <>
          {list.length === 0 ? <AppText color="muted">{t('timetables.noExams')}</AppText> : null}
          {list.map((e) => (
            <ListRow
              key={e.id}
              title={[byId.get(e.subjectId)?.name, e.title].filter(Boolean).join(' · ')}
              subtitle={[formatShortDate(e.date, labels.lang), e.time, e.room]
                .filter(Boolean)
                .join(' · ')}
              leading={<SubjectBar color={colorOf(byId.get(e.subjectId))} />}
              onPress={() => router.push({ pathname: '/exams/[id]', params: { id: e.id } })}
            />
          ))}
          <TextButton
            label={`+ ${t('timetables.addExam')}`}
            onPress={() =>
              router.push({
                pathname: '/exams/form',
                params: { timetableId: tt.id, date: tt.validFrom > today ? tt.validFrom : today },
              })
            }
          />
        </>
      );
    }
    if (tt.kind === 'revision') {
      const list = (blocks.data ?? []).filter((b) => b.timetableId === tt.id);
      return (
        <>
          {list.length === 0 ? (
            <AppText color="muted">{t('timetables.noRevisions')}</AppText>
          ) : null}
          {list.map((b) => {
            const subject = b.subjectId ? byId.get(b.subjectId) : undefined;
            return (
              <ListRow
                key={b.id}
                title={b.title ?? subject?.name ?? t('calendarItem.revision')}
                subtitle={[
                  formatShortDate(b.date, labels.lang),
                  `${b.startTime} – ${b.endTime}`,
                  t(`revision.status.${b.status}`),
                ].join(' · ')}
                struck={b.status === 'skipped'}
                leading={<SubjectBar color={colorOf(subject)} />}
                onPress={() => router.push({ pathname: '/revision/[id]', params: { id: b.id } })}
              />
            );
          })}
          <TextButton
            label={`+ ${t('timetables.addRevision')}`}
            onPress={() =>
              router.push({
                pathname: '/revision/form',
                params: { date: tt.validFrom > today ? tt.validFrom : today },
              })
            }
          />
        </>
      );
    }
    const courses = (series.data ?? []).filter((c) => c.timetableId === tt.id);
    return (
      <>
        {courses.length === 0 ? <AppText color="muted">{t('timetables.noCourses')}</AppText> : null}
        {courses.map(courseRow)}
        <TextButton
          label={`+ ${t('timetables.addCourse')}`}
          onPress={() => router.push({ pathname: '/courses/form', params: { timetableId: tt.id } })}
        />
      </>
    );
  };

  const timetableSection = (tt: Timetable, isActive: boolean) => (
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
        {isActive ? <Chip label={t('timetables.active')} tone="success" /> : null}
      </View>
      <Card>{contents(tt)}</Card>
    </View>
  );

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

      {timetableKinds.map((kind) => {
        const list = (timetables.data ?? []).filter((tt) => tt.kind === kind);
        if (list.length === 0) return null;
        return (
          <View key={kind} style={{ gap: spacing.lg }}>
            <AppText variant="label" color="muted">
              {t(`timetables.kinds.${kind}`).toLocaleUpperCase()}
            </AppText>
            {list.map((tt) => timetableSection(tt, active(kind)?.id === tt.id))}
          </View>
        );
      })}
      {(timetables.data ?? []).length > 0 ? (
        <TextButton
          label={`+ ${t('timetables.new')}`}
          onPress={() => router.push('/timetables/form')}
        />
      ) : null}

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
