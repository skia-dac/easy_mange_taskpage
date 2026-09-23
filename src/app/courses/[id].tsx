import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, getCourseSeries } from '@/modules/academic';
import { fromIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDate, formatLongDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, EmptyState, IconBadge, ListRow, TextButton } from '@/shared/ui';

export default function CourseDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { radius, spacing, scheme } = useTheme();
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { byId } = useSubjects();
  const course = useLiveQuery((db) => getCourseSeries(db, id), ['course_series'], [id]);

  if (course.loading) return null;
  const c = course.data;
  if (!c) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const subject = byId.get(c.subjectId);
  const color = colorOf(subject);
  const when = date
    ? formatLongDate(fromIsoDate(date), labels.lang)
    : c.recurrence === 'weekly'
      ? t('courses.every', { weekday: labels.weekday(c.weekday) })
      : formatLongDate(fromIsoDate(c.validFrom), labels.lang);

  const row = (
    icon: 'clock' | 'map-pin' | 'user' | 'calendar' | 'tag',
    label: string,
    value: string | null,
  ) =>
    value ? <ListRow title={value} subtitle={label} leading={<IconBadge icon={icon} />} /> : null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: t('courses.detailTitle'),
          headerRight: () => (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/courses/form', params: { id: c.id } })}
            />
          ),
        }}
      />
      <View
        style={{
          backgroundColor: scheme === 'dark' ? color.softDark : color.soft,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.xs,
        }}
      >
        <AppText
          variant="caption"
          style={{ color: scheme === 'dark' ? color.strongDark : color.strong }}
        >
          {labels.courseType(c.courseType)}
        </AppText>
        <AppText variant="title">{c.title ?? subject?.name ?? ''}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Feather
            name="calendar"
            size={15}
            color={scheme === 'dark' ? color.strongDark : color.strong}
          />
          <AppText>{when}</AppText>
        </View>
      </View>
      <Card>
        {row('clock', t('courses.start'), `${c.startTime} – ${c.endTime}`)}
        {row('map-pin', t('courses.room'), c.room)}
        {row('user', t('courses.teacher'), c.teacher)}
        {c.recurrence === 'weekly'
          ? row(
              'calendar',
              t('courses.recurrence'),
              t('timetables.period', {
                from: formatDate(c.validFrom, labels.lang),
                until: formatDate(c.validUntil, labels.lang),
              }),
            )
          : null}
        {c.description ? <AppText color="muted">{c.description}</AppText> : null}
      </Card>
      {subject ? (
        <Card>
          <ListRow
            title={subject.name}
            subtitle={t('courses.subject')}
            onPress={() => router.push({ pathname: '/subjects/[id]', params: { id: subject.id } })}
          />
        </Card>
      ) : null}
      <Button
        label={t('subjects.addAssignment')}
        onPress={() =>
          router.push({
            pathname: '/work/form',
            params: { kind: 'assignment', subjectId: c.subjectId, fromCourse: '1' },
          })
        }
      />
    </ScrollView>
  );
}
