import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ExamRow, WorkRow } from '@/components/AgendaRows';
import { NoteCard } from '@/components/NoteCard';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  colorOf,
  formatGrade,
  getSubject,
  listCourseExceptions,
  listCourseSeries,
  listExams,
  listOffPeriods,
  weightedAverage,
  occurrencesInRange,
} from '@/modules/academic';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { compareWorkItems, listNotes, listWorkItems } from '@/modules/productivity';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  ChoiceSheet,
  confirmDestructive,
  EmptyState,
  IconBadge,
  ListRow,
  SectionHeader,
  showError,
  TextButton,
  type ChoiceOption,
  LoadingScreen,
} from '@/shared/ui';
import { deleteSubject, subjectUsage, type SubjectUsage } from '@/workflows';

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
  // Pour « Prochain : … » : une séance annulée ou tombant pendant des vacances suspendues ne compte pas.
  const exceptions = useLiveQuery((d) => listCourseExceptions(d), ['course_exceptions'], []);
  const offPeriods = useLiveQuery((d) => listOffPeriods(d), ['off_periods'], []);
  const exams = useLiveQuery((d) => listExams(d, { subjectId: id }), ['exams'], [id]);
  const average = weightedAverage(exams.data ?? []);
  const gradedCount = (exams.data ?? []).filter((e) => e.grade !== null).length;
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

  const [deleteSheet, setDeleteSheet] = useState<SubjectUsage | null>(null);
  const s = subject.data;
  if (subject.loading) return <LoadingScreen />;
  if (!s) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const color = colorOf(s);
  const strong = scheme === 'dark' ? color.strongDark : color.strong;
  const soft = scheme === 'dark' ? color.softDark : color.soft;

  /** Suppression (§16) : on annonce ce qui est lié, puis on laisse choisir. */
  const doDelete = (mode: 'keepWork' | 'deleteAll') =>
    deleteSubject(db, s.id, mode).then(
      () => goBack(),
      (e: unknown) => showError(userMessageKey(e)),
    );
  const askDelete = async () => {
    try {
      const usage = await subjectUsage(db, s.id);
      const total = usage.courses + usage.exams + usage.tasks + usage.assignments + usage.notes;
      if (total === 0) {
        const ok = await confirmDestructive(
          t('subjects.deleteTitle', { name: s.name }),
          t('subjects.deleteNothing'),
          t('common.delete'),
        );
        if (ok) await doDelete('deleteAll');
        return;
      }
      setDeleteSheet(usage);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };
  const deleteOptions: ChoiceOption[] = [
    ...(deleteSheet && deleteSheet.tasks + deleteSheet.assignments + deleteSheet.notes > 0
      ? [{ label: t('subjects.keepWork'), onPress: () => void doDelete('keepWork') }]
      : []),
    {
      label: t('subjects.deleteAll'),
      destructive: true,
      onPress: () => void doDelete('deleteAll'),
    },
  ];

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
        {(series.data ?? []).map((c) => {
          const today = toIsoDate(now);
          const next = occurrencesInRange([c], today, addDaysIso(today, 60), {
            exceptions: exceptions.data ?? [],
            offPeriods: offPeriods.data ?? [],
          }).find((o) => o.status !== 'cancelled');
          return (
            <ListRow
              key={c.id}
              title={
                c.recurrence === 'weekly'
                  ? t('courses.every', { weekday: labels.weekday(c.weekday) })
                  : formatShortDate(c.validFrom, labels.lang)
              }
              subtitle={[
                `${c.startTime} – ${c.endTime}`,
                labels.courseType(c.courseType),
                c.room,
                next
                  ? t('subjects.nextOn', { date: formatShortDate(next.date, labels.lang) })
                  : t('subjects.ended'),
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() =>
                router.push({
                  pathname: '/courses/[id]',
                  params: { id: c.id, ...(next ? { date: next.originalDate } : {}) },
                })
              }
            />
          );
        })}
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
        {average !== null ? (
          <ListRow
            title={t('grades.on20', { value: formatGrade(average, labels.lang) })}
            subtitle={t('grades.subjectAverage', { count: gradedCount })}
            leading={<IconBadge icon="award" color="success" background="successSoft" />}
            onPress={() => router.push('/grades')}
          />
        ) : null}
        {(exams.data ?? []).map((e) => (
          <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
        ))}
      </Card>

      <TextButton label={t('subjects.delete')} color="danger" onPress={() => void askDelete()} />
      <ChoiceSheet
        visible={deleteSheet !== null}
        title={t('subjects.deleteTitle', { name: s.name })}
        message={deleteSheet ? t('subjects.deleteUsage', deleteSheet) : undefined}
        options={deleteOptions}
        onClose={() => setDeleteSheet(null)}
      />
    </ScrollView>
  );
}
