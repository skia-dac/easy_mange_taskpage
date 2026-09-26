import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { eventHref } from './eventHref';
import { useLabels } from '@/hooks/useLabels';
import { useWorkActions } from '@/hooks/useWorkActions';
import { colorOf, countdown, type Exam, type Occurrence, type Subject } from '@/modules/academic';
import {
  isOverdue,
  isSlotEvent,
  type PersonalEvent,
  type RevisionBlock,
  type WorkItem,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Checkbox, Chip, IconBadge, ListRow, SubjectBar, SwipeRow } from '@/shared/ui';

type SubjectMap = ReadonlyMap<string, Subject>;

export function CourseRow({
  occurrence,
  subjects,
}: {
  occurrence: Occurrence;
  subjects: SubjectMap;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const labels = useLabels();
  const subject = subjects.get(occurrence.subjectId);
  const cancelled = occurrence.status === 'cancelled';
  const details = [labels.courseType(occurrence.courseType), occurrence.room, occurrence.teacher]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      title={occurrence.title ?? subject?.name ?? ''}
      subtitle={details}
      struck={cancelled}
      onPress={() =>
        router.push({
          pathname: '/courses/[id]',
          params: { id: occurrence.seriesId, date: occurrence.originalDate },
        })
      }
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 48, alignItems: 'flex-end' }}>
            <AppText variant="bodyStrong" color={cancelled ? 'muted' : 'text'}>
              {occurrence.startTime}
            </AppText>
            <AppText variant="caption" color="muted">
              {occurrence.endTime}
            </AppText>
          </View>
          <SubjectBar color={colorOf(subject)} />
        </View>
      }
      trailing={
        cancelled ? (
          <Chip label={t('occurrence.cancelled')} tone="danger" />
        ) : occurrence.status === 'modified' ? (
          <Chip label={t('occurrence.modified')} tone="warning" />
        ) : undefined
      }
    />
  );
}

/** Devoir ou tâche, avec case à cocher pour le terminer rapidement (§59). */
export function WorkRow({
  item,
  subjects,
  now,
  showDate,
  onPostpone,
  progress,
}: {
  item: WorkItem;
  subjects: SubjectMap;
  now: Date;
  showDate?: boolean;
  /** Active le glisser : à droite pour terminer, à gauche pour reporter. */
  onPostpone?: (item: WorkItem) => void;
  /** Avancement de la checklist, s'il y en a une. */
  progress?: { done: number; total: number };
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const actions = useWorkActions();
  const subject = item.subjectId ? subjects.get(item.subjectId) : undefined;
  const done = item.status === 'done';
  const late = isOverdue(item, now);
  const when = [showDate ? formatShortDate(item.dueDate, labels.lang) : null, item.dueTime]
    .filter(Boolean)
    .join(' · ');
  const toggle = () => void actions.setDone(item, !done);

  const row = (
    <ListRow
      title={item.title}
      struck={done}
      subtitle={[
        t(`calendarItem.${item.kind}`),
        subject?.name,
        when,
        item.estimatedMinutes ? labels.duration(item.estimatedMinutes) : null,
        progress && progress.total > 0
          ? t('subtasks.progress', { done: progress.done, total: progress.total })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      leading={<Checkbox checked={done} onToggle={toggle} accessibilityLabel={item.title} />}
      trailing={
        late ? (
          <Chip label={t('status.overdue')} tone="danger" />
        ) : item.priority === 'urgent' || item.priority === 'important' ? (
          <Chip label={labels.priority(item.priority)} tone="warning" />
        ) : undefined
      }
      onPress={() =>
        router.push({ pathname: '/work/[id]', params: { id: item.id, kind: item.kind } })
      }
    />
  );
  if (!onPostpone || done) return row;
  return (
    <SwipeRow
      right={{ label: t('work.markDone'), icon: 'check', color: 'success', onAction: toggle }}
      left={{
        label: t('postpone.action'),
        icon: 'clock',
        color: 'warning',
        onAction: () => onPostpone(item),
      }}
    >
      {row}
    </SwipeRow>
  );
}

export function ExamRow({ exam, subjects, now }: { exam: Exam; subjects: SubjectMap; now: Date }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const subject = subjects.get(exam.subjectId);
  const c = countdown(exam.date, toIsoDate(now));
  return (
    <ListRow
      title={[t('calendarItem.exam'), subject?.name].filter(Boolean).join(' · ')}
      subtitle={[exam.title, formatShortDate(exam.date, labels.lang), exam.time, exam.room]
        .filter(Boolean)
        .join(' · ')}
      leading={<IconBadge icon="award" color="danger" background="dangerSoft" />}
      trailing={
        c.kind === 'past' ? undefined : (
          <Chip label={labels.countdown(c)} tone={c.kind === 'inDays' ? 'primary' : 'warning'} />
        )
      }
      onPress={() => router.push({ pathname: '/exams/[id]', params: { id: exam.id } })}
    />
  );
}

export function EventRow({ event }: { event: PersonalEvent }) {
  const { t } = useTranslation();
  const time = event.startTime
    ? [event.startTime, event.endTime].filter(Boolean).join(' – ')
    : t('calendarItem.allDay');
  return (
    <ListRow
      title={event.title}
      subtitle={[isSlotEvent(event) ? t('planning.slot') : t('calendarItem.event'), time].join(
        ' · ',
      )}
      leading={
        <IconBadge
          icon={isSlotEvent(event) ? 'repeat' : 'star'}
          color="warning"
          background="warningSoft"
        />
      }
      onPress={() => router.push(eventHref(event))}
    />
  );
}

export function RevisionRow({ block, subjects }: { block: RevisionBlock; subjects: SubjectMap }) {
  const { t } = useTranslation();
  const subject = block.subjectId ? subjects.get(block.subjectId) : undefined;
  const done = block.status === 'done';
  return (
    <ListRow
      title={block.title ?? subject?.name ?? t('calendarItem.revision')}
      subtitle={[
        t('calendarItem.revision'),
        block.title ? subject?.name : null,
        `${block.startTime} – ${block.endTime}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      struck={block.status === 'skipped'}
      leading={
        <IconBadge
          icon={done ? 'check' : 'book-open'}
          color={done ? 'success' : 'primary'}
          background={done ? 'successSoft' : 'primarySoft'}
        />
      }
      trailing={done ? <Chip label={t('revision.status.done')} tone="success" /> : undefined}
      onPress={() => router.push({ pathname: '/revision/[id]', params: { id: block.id } })}
    />
  );
}
