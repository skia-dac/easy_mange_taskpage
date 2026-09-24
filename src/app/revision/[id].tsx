import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, getExam } from '@/modules/academic';
import {
  blockMinutes,
  deleteRevisionBlock,
  getRevisionBlock,
  setRevisionStatus,
} from '@/modules/productivity';
import { fromIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatLongDate, formatShortDate } from '@/shared/format';
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
  SubjectDot,
  TextButton,
} from '@/shared/ui';

/** Une séance de révision : la lancer (minuteur), la marquer faite, la passer ou la supprimer. */
export default function RevisionDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { byId } = useSubjects();
  const block = useLiveQuery((d) => getRevisionBlock(d, id), ['revision_blocks'], [id]);
  const examId = block.data?.examId ?? null;
  const exam = useLiveQuery(
    (d) => (examId ? getExam(d, examId) : Promise.resolve(null)),
    ['exams'],
    [examId],
  );

  if (block.loading) return null;
  const b = block.data;
  if (!b) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;
  const subject = b.subjectId ? byId.get(b.subjectId) : undefined;
  const fail = (e: unknown) => showError(userMessageKey(e));

  const remove = async () => {
    const ok = await confirmDestructive(
      t('revision.deleteTitle'),
      t('revision.deleteMessage'),
      t('common.delete'),
    );
    if (ok) deleteRevisionBlock(db, b.id).then(() => router.back(), fail);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: t('revision.detailTitle'),
          headerRight: () => (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/revision/form', params: { id: b.id } })}
            />
          ),
        }}
      />
      <AppText variant="title">{b.title ?? subject?.name ?? t('calendarItem.revision')}</AppText>
      <Chip
        label={t(`revision.status.${b.status}`)}
        tone={b.status === 'done' ? 'success' : b.status === 'skipped' ? 'muted' : 'primary'}
      />
      <Card>
        <ListRow
          title={formatLongDate(fromIsoDate(b.date), labels.lang)}
          subtitle={`${b.startTime} – ${b.endTime} · ${labels.duration(blockMinutes(b))}`}
          leading={<IconBadge icon="clock" />}
        />
        {subject ? (
          <ListRow
            title={subject.name}
            subtitle={t('study.subject')}
            leading={<SubjectDot color={colorOf(subject)} size={14} />}
            onPress={() => router.push({ pathname: '/subjects/[id]', params: { id: subject.id } })}
          />
        ) : null}
        {exam.data ? (
          <ListRow
            title={[
              exam.data.title ?? t('calendarItem.exam'),
              formatShortDate(exam.data.date, labels.lang),
            ].join(' · ')}
            subtitle={t('revision.forExam')}
            leading={<IconBadge icon="award" color="danger" background="dangerSoft" />}
            onPress={() =>
              router.push({ pathname: '/exams/[id]', params: { id: exam.data?.id ?? '' } })
            }
          />
        ) : null}
      </Card>
      {b.status !== 'done' ? (
        <Button
          label={t('revision.start')}
          onPress={() =>
            router.push({
              pathname: '/study',
              params: { blockId: b.id, ...(b.subjectId ? { subjectId: b.subjectId } : {}) },
            })
          }
        />
      ) : null}
      {b.status === 'planned' ? (
        <>
          <Button
            variant="secondary"
            label={t('revision.markDone')}
            onPress={() => setRevisionStatus(db, b.id, 'done').catch(fail)}
          />
          <TextButton
            label={t('revision.skip')}
            onPress={() => setRevisionStatus(db, b.id, 'skipped').catch(fail)}
          />
        </>
      ) : (
        <TextButton
          label={t('revision.backToPlanned')}
          onPress={() => setRevisionStatus(db, b.id, 'planned').catch(fail)}
        />
      )}
      <TextButton label={t('revision.delete')} color="danger" onPress={() => void remove()} />
    </ScrollView>
  );
}
