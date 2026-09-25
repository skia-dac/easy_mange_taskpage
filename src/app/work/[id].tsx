import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { usePostpone } from '@/components/PostponeSheet';
import { useWorkActions } from '@/hooks/useWorkActions';
import { SubtaskList } from '@/components/SubtaskList';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { deleteWorkItem, getWorkItem, isOverdue, type WorkKind } from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDate, formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
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
  LoadingScreen,
  KeyboardAvoiding,
} from '@/shared/ui';

export default function WorkDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const now = useNow();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: WorkKind = params.kind === 'task' ? 'task' : 'assignment';
  const { byId } = useSubjects();
  const postpone = usePostpone();
  const actions = useWorkActions();
  const item = useLiveQuery(
    (d) => getWorkItem(d, kind, params.id),
    [kind === 'task' ? 'tasks' : 'assignments'],
    [kind, params.id],
  );

  if (item.loading) return <LoadingScreen />;
  const w = item.data;
  if (!w) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const subject = w.subjectId ? byId.get(w.subjectId) : undefined;
  const done = w.status === 'done';
  const toggle = () => actions.setDone(w, !done);

  return (
    <KeyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Stack.Screen
          options={{
            title: t(`calendarItem.${kind}`),
            headerRight: () => (
              <TextButton
                label={t('common.edit')}
                onPress={() => router.push({ pathname: '/work/form', params: { kind, id: w.id } })}
              />
            ),
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {subject ? <Chip label={subject.name} subject={colorOf(subject)} /> : null}
          {isOverdue(w, now) ? <Chip label={t('status.overdue')} tone="danger" /> : null}
          {w.priority !== 'normal' ? (
            <Chip
              label={labels.priority(w.priority)}
              tone={w.priority === 'low' ? 'muted' : 'warning'}
            />
          ) : null}
        </View>
        <AppText variant="title" style={done ? { textDecorationLine: 'line-through' } : undefined}>
          {w.title}
        </AppText>
        <Card>
          <ListRow
            title={[formatShortDate(w.dueDate, labels.lang), w.dueTime].filter(Boolean).join(' · ')}
            subtitle={t('work.due')}
            leading={<IconBadge icon="clock" />}
          />
          {w.estimatedMinutes ? (
            <ListRow
              title={labels.duration(w.estimatedMinutes)}
              subtitle={t('work.estimate')}
              leading={<IconBadge icon="watch" />}
            />
          ) : null}
          {w.repeat !== 'none' ? (
            <ListRow
              title={t(`repeat.${w.repeat}`)}
              subtitle={t('work.repeat')}
              leading={<IconBadge icon="repeat" />}
            />
          ) : null}
          <ListRow
            title={
              done && w.completedAt
                ? t('work.completedOn', {
                    date: formatDate(toIsoDate(new Date(w.completedAt)), labels.lang),
                  })
                : labels.status(w.status)
            }
            subtitle={t('work.status')}
            leading={<IconBadge icon="check-circle" color="success" background="successSoft" />}
          />
        </Card>
        {w.description ? (
          <Card>
            <AppText>{w.description}</AppText>
          </Card>
        ) : null}
        <SubtaskList kind={kind} workId={w.id} />
        <Button
          label={done ? t('work.reopen') : t('work.markDone')}
          onPress={() => void toggle()}
        />
        {!done ? (
          <Button
            variant="secondary"
            label={t('postpone.action')}
            onPress={() => postpone.open(w)}
          />
        ) : null}
        {!done && w.subjectId ? (
          <TextButton
            label={t('work.startStudy')}
            onPress={() =>
              router.push({ pathname: '/study', params: { subjectId: w.subjectId ?? '' } })
            }
          />
        ) : null}
        <TextButton
          label={kind === 'task' ? t('work.deleteTask') : t('work.deleteAssignment')}
          color="danger"
          onPress={() => {
            void confirmDestructive(
              t('work.deleteTitle', { title: w.title }),
              t('work.deleteMessage'),
              t('common.delete'),
            ).then((ok) => {
              if (ok)
                deleteWorkItem(db, kind, w.id).then(
                  () => goBack(),
                  (e: unknown) => showError(userMessageKey(e)),
                );
            });
          }}
        />
        {postpone.sheet}
      </ScrollView>
    </KeyboardAvoiding>
  );
}
