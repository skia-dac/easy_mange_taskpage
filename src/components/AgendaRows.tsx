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
import {
  AppText,
  Checkbox,
  Chip,
  IconBadge,
  itemTypes,
  ListRow,
  Settle,
  SubjectBar,
  SwipeRow,
  type ItemTypeStyle,
  type SwipeAccessibility,
} from '@/shared/ui';

type SubjectMap = ReadonlyMap<string, Subject>;

const badge = ({ icon, color, background }: ItemTypeStyle) => ({ icon, color, background });

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
  const status = cancelled
    ? { label: t('occurrence.cancelled'), tone: 'danger' as const }
    : occurrence.status === 'modified'
      ? { label: t('occurrence.modified'), tone: 'warning' as const }
      : null;
  const time = `${occurrence.startTime} – ${occurrence.endTime}`;
  return (
    <ListRow
      accessibilityLabel={[occurrence.title ?? subject?.name ?? '', time, details]
        .filter(Boolean)
        .join(', ')}
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
      trailing={status ? <Chip label={status.label} tone={status.tone} /> : undefined}
      trailingLabel={status?.label}
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
  showKind,
}: {
  item: WorkItem;
  subjects: SubjectMap;
  now: Date;
  showDate?: boolean;
  /**
   * Le type (« Tâche ») en tête du sous-titre : seulement dans une liste qui mêle plusieurs types
   * (calendrier). Dans une liste de tâches, il se répéterait sur chaque ligne.
   */
  showKind?: boolean;
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
  const when = [
    showDate && item.dueDate ? formatShortDate(item.dueDate, labels.lang) : null,
    item.dueTime,
  ]
    .filter(Boolean)
    .join(' · ');
  const toggle = () => void actions.setDone(item, !done);
  const flag = late
    ? { label: t('status.overdue'), tone: 'danger' as const }
    : item.priority === 'urgent' || item.priority === 'important'
      ? { label: labels.priority(item.priority), tone: 'warning' as const }
      : null;

  const swipe = {
    right: { label: t('work.markDone'), icon: 'check', color: 'success', onAction: toggle },
    // Sans date, il n'y a rien à reporter : pas de glisser à gauche.
    left: item.dueDate
      ? {
          label: t('postpone.action'),
          icon: 'clock' as const,
          color: 'warning' as const,
          onAction: () => onPostpone?.(item),
        }
      : undefined,
  } as const;

  const line = (a11y?: SwipeAccessibility) => (
    <ListRow
      {...a11y}
      title={item.title}
      struck={done}
      subtitle={[
        showKind ? t(`calendarItem.${item.kind}`) : null,
        subject?.name,
        when,
        item.estimatedMinutes ? labels.duration(item.estimatedMinutes) : null,
        progress && progress.total > 0
          ? t('subtasks.progress', { done: progress.done, total: progress.total })
          : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      control={<Checkbox checked={done} onToggle={toggle} accessibilityLabel={item.title} />}
      trailing={flag ? <Chip label={flag.label} tone={flag.tone} /> : undefined}
      trailingLabel={flag?.label}
      onPress={() =>
        router.push({ pathname: '/work/[id]', params: { id: item.id, kind: item.kind } })
      }
    />
  );
  if (!onPostpone) return <Settle done={done}>{line()}</Settle>;
  return (
    <Settle done={done}>
      <SwipeRow enabled={!done} right={swipe.right} left={swipe.left}>
        {line}
      </SwipeRow>
    </Settle>
  );
}

export function ExamRow({ exam, subjects, now }: { exam: Exam; subjects: SubjectMap; now: Date }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const subject = subjects.get(exam.subjectId);
  const c = countdown(exam.date, toIsoDate(now));
  const remaining = c.kind === 'past' ? null : labels.countdown(c);
  return (
    <ListRow
      title={[t('calendarItem.exam'), subject?.name].filter(Boolean).join(' · ')}
      subtitle={[exam.title, formatShortDate(exam.date, labels.lang), exam.time, exam.room]
        .filter(Boolean)
        .join(' · ')}
      leading={<IconBadge {...badge(itemTypes.exam)} />}
      trailing={
        remaining ? (
          <Chip label={remaining} tone={c.kind === 'inDays' ? 'primary' : 'warning'} />
        ) : undefined
      }
      trailingLabel={remaining}
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
      leading={<IconBadge {...badge(isSlotEvent(event) ? itemTypes.slot : itemTypes.event)} />}
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
        done ? (
          <IconBadge icon="check" color="success" background="successSoft" />
        ) : (
          <IconBadge {...badge(itemTypes.revision)} />
        )
      }
      trailing={done ? <Chip label={t('revision.status.done')} tone="success" /> : undefined}
      trailingLabel={done ? t('revision.status.done') : null}
      onPress={() => router.push({ pathname: '/revision/[id]', params: { id: block.id } })}
    />
  );
}
