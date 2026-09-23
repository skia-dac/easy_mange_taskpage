import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { colorOf, countdown, type Exam, type Occurrence, type Subject } from '@/modules/academic';
import {
  isOverdue,
  setWorkStatus,
  type PersonalEvent,
  type WorkItem,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Checkbox, Chip, IconBadge, ListRow, showError, SubjectBar } from '@/shared/ui';

type SubjectMap = ReadonlyMap<string, Subject>;

export function CourseRow({
  occurrence,
  subjects,
}: {
  occurrence: Occurrence;
  subjects: SubjectMap;
}) {
  const { spacing } = useTheme();
  const labels = useLabels();
  const subject = subjects.get(occurrence.subjectId);
  const details = [labels.courseType(occurrence.courseType), occurrence.room, occurrence.teacher]
    .filter(Boolean)
    .join(' · ');
  return (
    <ListRow
      title={occurrence.title ?? subject?.name ?? ''}
      subtitle={details}
      onPress={() =>
        router.push({
          pathname: '/courses/[id]',
          params: { id: occurrence.seriesId, date: occurrence.date },
        })
      }
      leading={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 48, alignItems: 'flex-end' }}>
            <AppText variant="bodyStrong">{occurrence.startTime}</AppText>
            <AppText variant="caption" color="muted">
              {occurrence.endTime}
            </AppText>
          </View>
          <SubjectBar color={colorOf(subject)} />
        </View>
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
}: {
  item: WorkItem;
  subjects: SubjectMap;
  now: Date;
  showDate?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const subject = item.subjectId ? subjects.get(item.subjectId) : undefined;
  const done = item.status === 'done';
  const late = isOverdue(item, now);
  const when = [showDate ? formatShortDate(item.dueDate, labels.lang) : null, item.dueTime]
    .filter(Boolean)
    .join(' · ');
  const toggle = () =>
    setWorkStatus(db, item.kind, item.id, done ? 'todo' : 'done').catch((e: unknown) =>
      showError(userMessageKey(e)),
    );

  return (
    <ListRow
      title={item.title}
      struck={done}
      subtitle={[t(`calendarItem.${item.kind}`), subject?.name, when].filter(Boolean).join(' · ')}
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
      subtitle={[t('calendarItem.event'), time].join(' · ')}
      leading={<IconBadge icon="star" color="warning" background="warningSoft" />}
      onPress={() => router.push({ pathname: '/events/form', params: { id: event.id } })}
    />
  );
}
