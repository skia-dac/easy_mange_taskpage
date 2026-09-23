import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  cancelOccurrence,
  colorOf,
  deleteCourse,
  endSeriesBefore,
  getCourseException,
  getCourseSeries,
  restoreOccurrence,
} from '@/modules/academic';
import { NoteCard } from '@/components/NoteCard';
import { listNotes } from '@/modules/productivity';
import { fromIsoDate, toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDate, formatLongDate, formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  confirmDestructive,
  EmptyState,
  IconBadge,
  ListRow,
  showError,
  TextButton,
} from '@/shared/ui';

export default function CourseDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { radius, spacing, scheme } = useTheme();
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { byId } = useSubjects();
  const course = useLiveQuery((d) => getCourseSeries(d, id), ['course_series'], [id]);
  const exception = useLiveQuery(
    (d) => (date ? getCourseException(d, id, date) : Promise.resolve(null)),
    ['course_exceptions'],
    [id, date],
  );

  const notes = useLiveQuery(
    async (d) =>
      (await listNotes(d)).filter(
        (n) => n.courseSeriesId === id && (!date || n.courseDate === date),
      ),
    ['notes'],
    [id, date],
  );

  if (course.loading || exception.loading) return null;
  const c = course.data;
  if (!c) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const ex = exception.data;
  const cancelled = ex?.kind === 'cancelled';
  const weekly = c.recurrence === 'weekly';
  const subject = byId.get(c.subjectId);
  const color = colorOf(subject);
  const strong = scheme === 'dark' ? color.strongDark : color.strong;
  const shown = {
    startTime: ex?.newStartTime ?? c.startTime,
    endTime: ex?.newEndTime ?? c.endTime,
    room: ex?.newRoom ?? c.room,
    teacher: ex?.newTeacher ?? c.teacher,
    title: ex?.newTitle ?? c.title,
  };
  const when = date
    ? formatLongDate(fromIsoDate(date), labels.lang)
    : weekly
      ? t('courses.every', { weekday: labels.weekday(c.weekday) })
      : formatLongDate(fromIsoDate(c.validFrom), labels.lang);
  const fail = (e: unknown) => showError(userMessageKey(e));

  /** Modifier : une seule séance, cette séance et les suivantes, ou toute la série (§27). */
  const edit = () => {
    if (!weekly || !date) {
      router.push({ pathname: '/courses/form', params: { id: c.id } });
      return;
    }
    Alert.alert(
      t('occurrence.scopeTitle'),
      t('occurrence.scopeMessage', { weekday: labels.weekday(c.weekday) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('occurrence.scopeThis'),
          onPress: () =>
            router.push({ pathname: '/courses/occurrence', params: { seriesId: c.id, date } }),
        },
        {
          text: t('occurrence.scopeFollowing'),
          onPress: () =>
            router.push({
              pathname: '/courses/form',
              params: { id: c.id, scope: 'following', date },
            }),
        },
        {
          text: t('occurrence.scopeAll'),
          onPress: () =>
            router.push({ pathname: '/courses/form', params: { id: c.id, scope: 'all' } }),
        },
      ],
    );
  };

  /** Supprimer : même principe (§28). Une seule séance = la marquer annulée. */
  const remove = () => {
    const deleteAll = async () => {
      const ok = await confirmDestructive(
        t('courses.deleteTitle'),
        weekly
          ? t('courses.deleteSeries', { weekday: labels.weekday(c.weekday) })
          : t('courses.deleteOnce'),
        t('common.delete'),
      );
      if (ok) deleteCourse(db, c.id).then(() => router.dismissAll(), fail);
    };
    if (!weekly || !date) {
      void deleteAll();
      return;
    }
    Alert.alert(t('occurrence.deleteScopeTitle'), t('occurrence.deleteThisHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('occurrence.scopeThis'), onPress: () => void cancel() },
      {
        text: t('occurrence.scopeFollowing'),
        style: 'destructive',
        onPress: () => endSeriesBefore(db, c.id, date).then(() => router.back(), fail),
      },
      { text: t('occurrence.scopeAll'), style: 'destructive', onPress: () => void deleteAll() },
    ]);
  };

  const cancel = async () => {
    if (!date) return;
    const ok = await confirmDestructive(
      t('occurrence.cancelTitle'),
      t('occurrence.cancelMessage', { date: formatShortDate(date, labels.lang) }),
      t('occurrence.confirmCancel'),
    );
    if (ok) cancelOccurrence(db, c.id, date).catch(fail);
  };

  const row = (
    icon: 'clock' | 'map-pin' | 'user' | 'calendar',
    label: string,
    value: string | null,
  ) =>
    value ? <ListRow title={value} subtitle={label} leading={<IconBadge icon={icon} />} /> : null;

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
          title: t('courses.detailTitle'),
          headerRight: () => <TextButton label={t('common.edit')} onPress={edit} />,
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
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <AppText variant="caption" style={{ color: strong }}>
            {labels.courseType(c.courseType)}
          </AppText>
          {cancelled ? (
            <Chip label={t('occurrence.cancelled')} tone="danger" />
          ) : ex ? (
            <Chip label={t('occurrence.modified')} tone="warning" />
          ) : null}
        </View>
        <AppText
          variant="title"
          style={cancelled ? { textDecorationLine: 'line-through' } : undefined}
        >
          {shown.title ?? subject?.name ?? ''}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Feather name="calendar" size={15} color={strong} />
          <AppText>{when}</AppText>
        </View>
        {ex?.note ? <AppText color="muted">{ex.note}</AppText> : null}
      </View>
      <Card>
        {row('clock', t('courses.start'), `${shown.startTime} – ${shown.endTime}`)}
        {row('map-pin', t('courses.room'), shown.room)}
        {row('user', t('courses.teacher'), shown.teacher)}
        {weekly
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
      {(notes.data ?? []).length > 0 ? (
        <>
          <AppText variant="heading">{t('courses.notesTitle')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {(notes.data ?? []).map((n) => (
              <View key={n.id} style={{ width: '48%', flexGrow: 1 }}>
                <NoteCard note={n} subject={subject} />
              </View>
            ))}
          </View>
        </>
      ) : null}
      <Button
        label={t('notes.takeNotes')}
        onPress={() =>
          router.push({
            pathname: '/notes/[id]',
            params: {
              id: 'new',
              subjectId: c.subjectId,
              courseSeriesId: c.id,
              courseDate: date ?? toIsoDate(new Date()),
            },
          })
        }
      />
      <Button
        label={t('subjects.addAssignment')}
        onPress={() =>
          router.push({
            pathname: '/work/form',
            params: { kind: 'assignment', subjectId: c.subjectId, fromCourse: '1' },
          })
        }
      />
      {date && ex ? (
        <View style={{ gap: spacing.xs }}>
          {!cancelled ? (
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('occurrence.restoreHint')}
            </AppText>
          ) : null}
          <TextButton
            label={t('occurrence.restore')}
            onPress={() => restoreOccurrence(db, c.id, date).catch(fail)}
          />
        </View>
      ) : date && weekly ? (
        <TextButton label={t('occurrence.cancel')} color="warning" onPress={() => void cancel()} />
      ) : null}
      <TextButton label={t('courses.delete')} color="danger" onPress={remove} />
    </ScrollView>
  );
}
