import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { CourseRow, EventRow, ExamRow, RevisionRow } from '@/components/AgendaRows';
import { HabitDaySheet } from '@/components/HabitDaySheet';
import { HabitRow } from '@/components/HabitRow';
import { ReviewMoney } from '@/components/money/ReviewMoney';
import { MoodPicker } from '@/components/MoodPicker';
import { usePostpone } from '@/components/PostponeSheet';
import { useWorkActions } from '@/hooks/useWorkActions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  isScheduledOn,
  logOn,
  rescheduleWorkItem,
  setRevisionStatus,
  type Habit,
  type WorkItem,
} from '@/modules/productivity';
import { buildEveningReview, useAgendaData } from '@/projections';
import { useSpaces } from '@/shared/SpacesContext';
import { fromIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatLongDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Button,
  Card,
  Checkbox,
  ListRow,
  LoadingScreen,
  SectionHeader,
  showError,
  TextButton,
  confirmAction,
} from '@/shared/ui';

/** Bilan du soir : en une minute, on clôt la journée et on prépare demain. */
export default function EveningReviewScreen() {
  const personal = useSpaces().has('personal');
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const now = useNow(60_000);
  const { spacing } = useTheme();
  const agenda = useAgendaData();
  const { byId } = useSubjects();
  const weekStart = useWeekStart();
  const postpone = usePostpone();
  const actions = useWorkActions();
  const [habitSheet, setHabitSheet] = useState<Habit | null>(null);
  const review = useMemo(
    () => (agenda.data ? buildEveningReview(agenda.data, now) : null),
    [agenda.data, now],
  );
  const fail = (e: unknown) => showError(userMessageKey(e));

  if (!review || !agenda.data) return <LoadingScreen />;
  const habitLogs = agenda.data.habitLogs ?? [];
  const habits = (agenda.data.habits ?? []).filter((h) => isScheduledOn(h, review.today));
  const next = review.next;
  const nothingTomorrow =
    next.courses.length +
      next.due.length +
      next.exams.length +
      next.events.length +
      next.revisions.length ===
    0;

  const workRow = (w: WorkItem) => (
    <ListRow
      key={`${w.kind}-${w.id}`}
      title={w.title}
      subtitle={[t(`calendarItem.${w.kind}`), w.subjectId ? byId.get(w.subjectId)?.name : null]
        .filter(Boolean)
        .join(' · ')}
      leading={
        <Checkbox
          checked={false}
          accessibilityLabel={w.title}
          onToggle={() => void actions.setDone(w, true)}
        />
      }
      trailing={
        <TextButton
          label={t('postpone.tomorrow')}
          onPress={() => void actions.postpone(w, review.tomorrow)}
        />
      }
      onPress={() => postpone.open(w)}
    />
  );

  const postponeAll = async () => {
    const count = review.remaining.length;
    const ok = await confirmAction(
      t('review.postponeAllTitle'),
      t('review.postponeAllMessage', { count }),
      t('review.postponeAllConfirm'),
    );
    if (!ok) return;
    await Promise.all(
      review.remaining.map((w) => rescheduleWorkItem(db, w.kind, w.id, review.tomorrow)),
    ).catch(fail);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('review.title') }} />
      <AppText color="muted">{t('review.intro')}</AppText>

      <SectionHeader title={t('review.remaining')} />
      {review.remaining.length === 0 ? (
        <AppText color="success">{t('review.allDone')}</AppText>
      ) : (
        <>
          <Card>{review.remaining.map(workRow)}</Card>
          <TextButton
            label={t('review.postponeAll', { count: review.remaining.length })}
            onPress={() => void postponeAll()}
          />
        </>
      )}

      {review.revisions.length > 0 ? (
        <>
          <SectionHeader title={t('review.revisions')} />
          <Card>
            {review.revisions.map((b) => (
              <View key={b.id}>
                <RevisionRow block={b} subjects={byId} />
                <View
                  style={{ flexDirection: 'row', gap: spacing.lg, paddingLeft: spacing.xxl * 2 }}
                >
                  <TextButton
                    label={t('revision.markDone')}
                    onPress={() => setRevisionStatus(db, b.id, 'done').catch(fail)}
                  />
                  <TextButton
                    label={t('revision.skip')}
                    onPress={() => setRevisionStatus(db, b.id, 'skipped').catch(fail)}
                  />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {habits.length > 0 ? (
        <>
          <SectionHeader title={t('review.habits')} />
          <Card>
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                logs={habitLogs}
                day={review.today}
                today={review.today}
                weekStart={weekStart}
                onMore={setHabitSheet}
              />
            ))}
          </Card>
        </>
      ) : null}

      {personal ? (
        <>
          <ReviewMoney />

          <SectionHeader
            title={t('review.mood')}
            action={{ label: t('mood.history'), onPress: () => router.push('/mood') }}
          />
          <MoodPicker date={review.today} />
        </>
      ) : null}

      <SectionHeader
        title={t('review.tomorrow', {
          date: formatLongDate(fromIsoDate(review.tomorrow), labels.lang),
        })}
      />
      {nothingTomorrow ? (
        <AppText color="muted">{t('review.nothingTomorrow')}</AppText>
      ) : (
        <Card>
          {next.exams.map((e) => (
            <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
          ))}
          {next.courses.map((o) => (
            <CourseRow key={`${o.seriesId}-${o.date}`} occurrence={o} subjects={byId} />
          ))}
          {next.revisions.map((b) => (
            <RevisionRow key={b.id} block={b} subjects={byId} />
          ))}
          {next.events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
          {next.due.map((w) => (
            <ListRow
              key={`${w.kind}-${w.id}`}
              title={w.title}
              subtitle={t(`calendarItem.${w.kind}`)}
              onPress={() =>
                router.push({ pathname: '/work/[id]', params: { id: w.id, kind: w.kind } })
              }
            />
          ))}
        </Card>
      )}
      {next.plannedMinutes > 0 ? (
        <AppText color="muted">
          {t('review.plannedTime', { time: labels.duration(next.plannedMinutes) })}
        </AppText>
      ) : null}
      <Button label={t('review.done')} onPress={() => router.back()} />
      {postpone.sheet}
      {habitSheet ? (
        <HabitDaySheet
          habit={habitSheet}
          date={review.today}
          log={logOn(habitLogs, habitSheet.id, review.today)}
          onClose={() => setHabitSheet(null)}
        />
      ) : null}
    </ScrollView>
  );
}
