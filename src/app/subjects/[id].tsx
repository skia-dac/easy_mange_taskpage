import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';

import { ExamRow, WorkRow } from '@/components/AgendaRows';
import { NoteCard } from '@/components/NoteCard';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, getSubject, listCourseSeries, listExams } from '@/modules/academic';
import { compareWorkItems, listNotes, listWorkItems } from '@/modules/productivity';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  EmptyState,
  ListRow,
  SectionHeader,
  showError,
  TextButton,
} from '@/shared/ui';
import { deleteSubject, subjectUsage } from '@/workflows';

export default function SubjectDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const now = useNow();
  const { radius, spacing, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useSubjects();

  const subject = useLiveQuery((d) => getSubject(d, id), ['subjects'], [id]);
  const series = useLiveQuery(
    (d) => listCourseSeries(d, { subjectId: id }),
    ['course_series'],
    [id],
  );
  const exams = useLiveQuery((d) => listExams(d, { subjectId: id }), ['exams'], [id]);
  const notes = useLiveQuery((d) => listNotes(d, { subjectId: id }), ['notes'], [id]);
  const work = useLiveQuery(
    async (d) => {
      const [tasks, assignments] = await Promise.all([
        listWorkItems(d, 'task', { subjectId: id }),
        listWorkItems(d, 'assignment', { subjectId: id }),
      ]);
      return [...tasks, ...assignments].filter((w) => w.status !== 'done').sort(compareWorkItems);
    },
    ['tasks', 'assignments'],
    [id],
  );

  const s = subject.data;
  if (subject.loading) return null;
  if (!s) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const color = colorOf(s);
  const strong = scheme === 'dark' ? color.strongDark : color.strong;
  const soft = scheme === 'dark' ? color.softDark : color.soft;

  const askDelete = async () => {
    try {
      const usage = await subjectUsage(db, s.id);
      const total = usage.courses + usage.exams + usage.tasks + usage.assignments;
      const done = () => router.back();
      const doDelete = (mode: 'keepWork' | 'deleteAll') =>
        deleteSubject(db, s.id, mode).then(done, (e: unknown) => showError(userMessageKey(e)));
      const title = t('subjects.deleteTitle', { name: s.name });
      if (total === 0) {
        Alert.alert(title, t('subjects.deleteNothing'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: () => void doDelete('deleteAll'),
          },
        ]);
        return;
      }
      const buttons = [
        { text: t('common.cancel'), style: 'cancel' as const },
        ...(usage.tasks + usage.assignments > 0
          ? [{ text: t('subjects.keepWork'), onPress: () => void doDelete('keepWork') }]
          : []),
        {
          text: t('subjects.deleteAll'),
          style: 'destructive' as const,
          onPress: () => void doDelete('deleteAll'),
        },
      ];
      Alert.alert(title, t('subjects.deleteUsage', usage), buttons);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const info = (icon: 'user' | 'map-pin' | 'hash' | 'layers', text: string | null) =>
    text ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Feather name={icon} size={15} color={strong} />
        <AppText>{text}</AppText>
      </View>
    ) : null;

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
          title: '',
          headerRight: () => (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/subjects/form', params: { id: s.id } })}
            />
          ),
        }}
      />
      <View
        style={{
          backgroundColor: soft,
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.sm,
        }}
      >
        <AppText variant="title" style={{ color: strong }}>
          {s.name}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
          {info('user', s.teacher)}
          {info('map-pin', s.room)}
          {info('hash', s.code)}
          {info('layers', s.semester)}
        </View>
        {s.description ? <AppText color="muted">{s.description}</AppText> : null}
      </View>

      <SectionHeader
        title={t('subjects.courses')}
        action={{
          label: t('common.add'),
          onPress: () => router.push({ pathname: '/courses/form', params: { subjectId: s.id } }),
        }}
      />
      <Card>
        {(series.data ?? []).length === 0 ? (
          <AppText color="muted">{t('subjects.noCourses')}</AppText>
        ) : null}
        {(series.data ?? []).map((c) => (
          <ListRow
            key={c.id}
            title={
              c.recurrence === 'weekly'
                ? t('courses.every', { weekday: labels.weekday(c.weekday) })
                : c.validFrom
            }
            subtitle={[`${c.startTime} – ${c.endTime}`, labels.courseType(c.courseType), c.room]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id } })}
          />
        ))}
      </Card>

      <SectionHeader
        title={t('subjects.notes')}
        action={{
          label: t('notes.takeNotes'),
          onPress: () =>
            router.push({ pathname: '/notes/[id]', params: { id: 'new', subjectId: s.id } }),
        }}
      />
      {(notes.data ?? []).length === 0 ? (
        <AppText color="muted">{t('subjects.noNotes')}</AppText>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {(notes.data ?? []).slice(0, 4).map((n) => (
            <View key={n.id} style={{ width: '48%', flexGrow: 1 }}>
              <NoteCard note={n} subject={s} />
            </View>
          ))}
        </View>
      )}

      <SectionHeader
        title={t('subjects.work')}
        action={{
          label: t('common.add'),
          onPress: () =>
            router.push({
              pathname: '/work/form',
              params: { kind: 'assignment', subjectId: s.id },
            }),
        }}
      />
      <Card>
        {(work.data ?? []).length === 0 ? (
          <AppText color="muted">{t('subjects.nothing')}</AppText>
        ) : null}
        {(work.data ?? []).map((w) => (
          <WorkRow key={`${w.kind}-${w.id}`} item={w} subjects={byId} now={now} showDate />
        ))}
      </Card>

      <SectionHeader
        title={t('subjects.exams')}
        action={{
          label: t('common.add'),
          onPress: () => router.push({ pathname: '/exams/form', params: { subjectId: s.id } }),
        }}
      />
      <Card>
        {(exams.data ?? []).length === 0 ? (
          <AppText color="muted">{t('subjects.nothing')}</AppText>
        ) : null}
        {(exams.data ?? []).map((e) => (
          <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
        ))}
      </Card>

      <TextButton label={t('subjects.delete')} color="danger" onPress={() => void askDelete()} />
    </ScrollView>
  );
}
