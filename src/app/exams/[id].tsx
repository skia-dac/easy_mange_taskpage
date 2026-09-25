import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  colorOf,
  countdown,
  deleteExam,
  formatGrade,
  getExam,
  gradeOn20,
} from '@/modules/academic';
import { fromIsoDate, toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatLongDate, formatShortDate } from '@/shared/format';
import { listRevisionBlocks } from '@/modules/productivity';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Button,
  Card,
  confirmDestructive,
  EmptyState,
  IconBadge,
  ListRow,
  SectionHeader,
  showError,
  TextButton,
  LoadingScreen,
} from '@/shared/ui';

export default function ExamDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const now = useNow(60_000);
  const { radius, spacing, scheme } = useTheme();
  const db = useDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useSubjects();
  const exam = useLiveQuery((db) => getExam(db, id), ['exams'], [id]);
  const revisions = useLiveQuery(
    (db) => listRevisionBlocks(db, { examId: id }),
    ['revision_blocks'],
    [id],
  );

  if (exam.loading) return <LoadingScreen />;
  const e = exam.data;
  if (!e) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const subject = byId.get(e.subjectId);
  const color = colorOf(subject);
  const strong = scheme === 'dark' ? color.strongDark : color.strong;
  const c = countdown(e.date, toIsoDate(now));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: t('exams.detailTitle'),
          headerRight: () => (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/exams/form', params: { id: e.id } })}
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
        {e.title ? (
          <AppText variant="label" style={{ color: strong, letterSpacing: 1 }}>
            {e.title.toLocaleUpperCase()}
          </AppText>
        ) : null}
        <AppText variant="title" style={{ color: strong }}>
          {subject?.name ?? ''}
        </AppText>
        <AppText variant="title" style={{ fontSize: 34, lineHeight: 40 }}>
          {labels.countdown(c)}
        </AppText>
      </View>
      <Card>
        <ListRow
          title={[formatLongDate(fromIsoDate(e.date), labels.lang), e.time]
            .filter(Boolean)
            .join(' · ')}
          subtitle={t('exams.when')}
          leading={<IconBadge icon="calendar" />}
        />
        {e.durationMinutes ? (
          <ListRow
            title={labels.duration(e.durationMinutes)}
            subtitle={t('exams.durationLabel')}
            leading={<IconBadge icon="clock" />}
          />
        ) : null}
        {e.room ? (
          <ListRow
            title={e.room}
            subtitle={t('exams.room')}
            leading={<IconBadge icon="map-pin" />}
          />
        ) : null}
        <ListRow
          title={
            e.grade === null
              ? t('grades.notGraded')
              : t('grades.result', {
                  grade: formatGrade(e.grade, labels.lang),
                  max: formatGrade(e.gradeMax, labels.lang),
                  on20: formatGrade(gradeOn20(e) ?? 0, labels.lang),
                })
          }
          subtitle={
            e.coefficient === 1
              ? t('grades.gradeLabel')
              : t('grades.gradeWithCoef', { coef: formatGrade(e.coefficient, labels.lang) })
          }
          leading={<IconBadge icon="award" color="success" background="successSoft" />}
          onPress={() => router.push({ pathname: '/exams/form', params: { id: e.id } })}
        />
      </Card>
      {e.description ? (
        <Card>
          <AppText variant="caption" color="muted">
            {t('exams.description')}
          </AppText>
          <AppText>{e.description}</AppText>
        </Card>
      ) : null}
      <SectionHeader title={t('revision.sectionTitle')} />
      {c.kind !== 'past' && c.kind !== 'today' ? (
        <Button
          label={
            (revisions.data ?? []).some((r) => r.status === 'planned')
              ? t('revision.replan')
              : t('revision.plan')
          }
          onPress={() => router.push({ pathname: '/revision/plan', params: { examId: e.id } })}
        />
      ) : null}
      {(revisions.data ?? []).length > 0 ? (
        <Card>
          {(revisions.data ?? []).map((r) => (
            <ListRow
              key={r.id}
              title={formatShortDate(r.date, labels.lang)}
              subtitle={`${r.startTime} – ${r.endTime} · ${t(`revision.status.${r.status}`)}`}
              struck={r.status === 'skipped'}
              leading={
                <IconBadge
                  icon={r.status === 'done' ? 'check' : 'book-open'}
                  color={r.status === 'done' ? 'success' : 'primary'}
                  background={r.status === 'done' ? 'successSoft' : 'primarySoft'}
                />
              }
              onPress={() => router.push({ pathname: '/revision/[id]', params: { id: r.id } })}
            />
          ))}
        </Card>
      ) : null}
      {subject ? (
        <Button
          variant="secondary"
          label={subject.name}
          onPress={() => router.push({ pathname: '/subjects/[id]', params: { id: subject.id } })}
        />
      ) : null}
      <TextButton
        label={t('exams.delete')}
        color="danger"
        onPress={() => {
          void confirmDestructive(
            t('exams.deleteTitle'),
            t('exams.deleteMessage'),
            t('common.delete'),
          ).then((ok) => {
            if (ok)
              deleteExam(db, e.id).then(
                () => router.back(),
                (err: unknown) => showError(userMessageKey(err)),
              );
          });
        }}
      />
    </ScrollView>
  );
}
