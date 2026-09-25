import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { CourseRow, EventRow, ExamRow, RevisionRow, WorkRow } from '@/components/AgendaRows';
import { usePostpone } from '@/components/PostponeSheet';
import { HeaderButton, SearchButton } from '@/components/SearchButton';
import { HabitDaySheet } from '@/components/HabitDaySheet';
import { HabitRow } from '@/components/HabitRow';
import { TodayMoneyCard } from '@/components/money/TodayMoneyCard';
import { ProfileButton } from '@/components/ProfileButton';
import { useProfile } from '@/hooks/useProfile';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  getNotificationPreferences,
  getTodayLayout,
  normalizeTodayLayout,
  type TodaySectionId,
} from '@/modules/identity';
import { isScheduledOn, logOn, subtaskCounts, type Habit } from '@/modules/productivity';
import { useSubjects } from '@/hooks/useSubjects';
import { buildToday, useAgendaData, type NextCourse } from '@/projections';
import { timeToMinutes } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDuration, formatLongDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Fab,
  IconBadge,
  Screen,
  SectionHeader,
  TextButton,
} from '@/shared/ui';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const now = useNow();
  const agenda = useAgendaData();
  const { subjects, byId, loading } = useSubjects();
  const { profile } = useProfile();
  const greeting = profile?.firstName
    ? t('today.greetingName', { name: profile.firstName })
    : t('today.greeting');
  const view = useMemo(
    () => (agenda.data ? buildToday(agenda.data, now) : null),
    [agenda.data, now],
  );

  const todo = view ? [...view.overdue, ...view.dueToday] : [];
  const weekStart = useWeekStart();
  const [habitSheet, setHabitSheet] = useState<Habit | null>(null);
  const habits = (agenda.data?.habits ?? []).filter((h) => view && isScheduledOn(h, view.today));
  const habitLogs = agenda.data?.habitLogs ?? [];
  const counts = useLiveQuery(subtaskCounts, ['work_subtasks'], []);
  const layoutQuery = useLiveQuery(getTodayLayout, ['app_settings'], []);
  const layout = layoutQuery.data ?? normalizeTodayLayout(null);
  const notif = useLiveQuery(getNotificationPreferences, ['app_settings'], []);
  const postpone = usePostpone();
  // Le soir (à partir de 2 h avant l'heure du bilan), une carte propose de préparer demain.
  const reviewTime = notif.data?.eveningReviewTime ?? '20:30';
  const eveningCard =
    now.getHours() * 60 + now.getMinutes() >= timeToMinutes(reviewTime) - 120 &&
    now.getHours() >= 16;

  const revisions = view
    ? (agenda.data?.revisionBlocks ?? []).filter((b) => b.date === view.today)
    : [];

  const sections: Record<TodaySectionId, ReactNode> = view
    ? {
        next: view.next ? (
          <NextCourseCard
            next={view.next}
            subjectName={byId.get(view.next.occurrence.subjectId)?.name ?? ''}
          />
        ) : (
          <EmptyState
            icon="sun"
            title={view.courses.length > 0 ? t('today.coursesDone') : t('today.emptyCourses')}
            message={
              view.courses.length > 0 || view.dayOff ? undefined : t('today.emptyCoursesHint')
            }
          />
        ),
        money: <TodayMoneyCard />,
        courses:
          view.courses.length > 0 ? (
            <>
              <SectionHeader title={t('today.coursesTitle')} />
              <Card>
                {view.courses.map((o) => (
                  <CourseRow key={`${o.seriesId}-${o.date}`} occurrence={o} subjects={byId} />
                ))}
              </Card>
            </>
          ) : null,
        revision:
          revisions.length > 0 ? (
            <>
              <SectionHeader title={t('today.revisionTitle')} />
              <Card>
                {revisions.map((b) => (
                  <RevisionRow key={b.id} block={b} subjects={byId} />
                ))}
              </Card>
            </>
          ) : null,
        habits: (
          <>
            <SectionHeader
              title={t('habits.todayTitle')}
              action={{ label: t('common.seeAll'), onPress: () => router.push('/habits') }}
            />
            {habits.length > 0 ? (
              <Card>
                {habits.map((h) => (
                  <HabitRow
                    key={h.id}
                    habit={h}
                    logs={habitLogs}
                    day={view.today}
                    today={view.today}
                    weekStart={weekStart}
                    onMore={setHabitSheet}
                  />
                ))}
              </Card>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => router.push('/habits')}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <IconBadge icon="target" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyStrong">{t('habits.startTitle')}</AppText>
                      <AppText variant="caption" color="muted">
                        {t('habits.startHint')}
                      </AppText>
                    </View>
                  </View>
                </Card>
              </Pressable>
            )}
          </>
        ),
        todo: (
          <>
            <SectionHeader
              title={t('today.todoTitle')}
              action={{
                label: t('common.seeAll'),
                onPress: () => router.navigate('/(tabs)/tasks'),
              }}
            />
            {todo.length > 0 ? (
              <Card>
                {todo.map((w) => (
                  <WorkRow
                    key={`${w.kind}-${w.id}`}
                    item={w}
                    subjects={byId}
                    now={now}
                    showDate={w.dueDate !== view.today}
                    onPostpone={postpone.open}
                    progress={counts.data?.get(`${w.kind}:${w.id}`)}
                  />
                ))}
              </Card>
            ) : (
              <AppText color="muted">{t('today.nothingTodo')}</AppText>
            )}
          </>
        ),
        events:
          view.events.length > 0 ? (
            <>
              <SectionHeader title={t('today.eventsTitle')} />
              <Card>
                {view.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </Card>
            </>
          ) : null,
        exams: (
          <>
            <SectionHeader title={t('today.examsTitle')} />
            {view.upcomingExams.length > 0 ? (
              <Card>
                {view.upcomingExams.map(({ exam }) => (
                  <ExamRow key={exam.id} exam={exam} subjects={byId} now={now} />
                ))}
              </Card>
            ) : (
              <AppText color="muted">{t('today.noExams')}</AppText>
            )}
          </>
        ),
      }
    : {
        next: null,
        money: null,
        courses: null,
        revision: null,
        habits: null,
        todo: null,
        events: null,
        exams: null,
      };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={greeting}
        subtitle={formatLongDate(now, i18n.language)}
        actions={
          <>
            <SearchButton />
            <HeaderButton icon="bell" label={t('notifications.title')} href="/notifications" />
            <ProfileButton />
          </>
        }
      >
        {!loading && subjects.length === 0 ? (
          <Card>
            <View style={{ gap: spacing.md }}>
              <AppText variant="heading">{t('today.firstSubject')}</AppText>
              <AppText color="muted">{t('today.firstSubjectHint')}</AppText>
              <Button
                label={t('profile.addSubject')}
                onPress={() => router.push('/subjects/form')}
              />
            </View>
          </Card>
        ) : null}

        {agenda.data?.studySession ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/study')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <IconBadge icon="clock" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{t('study.bannerTitle')}</AppText>
                  <AppText variant="caption" color="muted">
                    {t('study.bannerHint')}
                  </AppText>
                </View>
              </View>
            </Card>
          </Pressable>
        ) : null}

        {view?.dayOff ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <IconBadge icon="sun" color="warning" background="warningSoft" />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {t('today.dayOff', { name: view.dayOff.name })}
              </AppText>
            </View>
          </Card>
        ) : null}

        {view && eveningCard ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/review')}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <IconBadge icon="moon" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{t('review.cardTitle')}</AppText>
                  <AppText variant="caption" color="muted">
                    {t('review.cardHint')}
                  </AppText>
                </View>
                <Feather name="chevron-right" size={20} color={colors.muted} />
              </View>
            </Card>
          </Pressable>
        ) : null}

        {view
          ? layout.order
              .filter((id) => !layout.hidden.includes(id))
              .map((id) => <Fragment key={id}>{sections[id]}</Fragment>)
          : null}

        {view ? (
          <TextButton
            label={t('todayLayout.customize')}
            onPress={() => router.push('/today-layout')}
          />
        ) : null}
        <View style={{ height: 80 }} />
      </Screen>
      {habitSheet && view ? (
        <HabitDaySheet
          habit={habitSheet}
          date={view.today}
          log={logOn(habitLogs, habitSheet.id, view.today)}
          onClose={() => setHabitSheet(null)}
        />
      ) : null}
      <Fab accessibilityLabel={t('add.title')} onPress={() => router.push('/add')} />
      {postpone.sheet}
    </View>
  );
}

function NextCourseCard({ next, subjectName }: { next: NextCourse; subjectName: string }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const o = next.occurrence;
  const ongoing = next.state === 'ongoing';
  const time = formatDuration(next.minutes);
  const info = (icon: 'clock' | 'map-pin' | 'user', text: string | null) =>
    text ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Feather name={icon} size={15} color={colors.onPrimary} />
        <AppText color="onPrimary">{text}</AppText>
      </View>
    ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ongoing ? t('today.ongoing') : t('today.nextCourse')} : ${subjectName}, ${o.startTime} – ${o.endTime}`}
      onPress={() =>
        router.push({ pathname: '/courses/[id]', params: { id: o.seriesId, date: o.originalDate } })
      }
      style={({ pressed }) => ({
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        padding: spacing.xl,
        gap: spacing.sm,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <AppText variant="label" color="onPrimary" style={{ letterSpacing: 1 }}>
          {(ongoing ? t('today.ongoing') : t('today.nextCourse')).toLocaleUpperCase()}
        </AppText>
        <AppText variant="bodyStrong" color="onPrimary">
          {ongoing ? t('today.endsIn', { time }) : t('today.startsIn', { time })}
        </AppText>
      </View>
      <AppText variant="title" color="onPrimary" style={{ fontSize: 24, lineHeight: 30 }}>
        {o.title ?? subjectName}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        {info('clock', `${o.startTime} – ${o.endTime}`)}
        {info('map-pin', o.room)}
        {info('user', o.teacher)}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/notes/[id]',
            params: {
              id: 'new',
              subjectId: o.subjectId,
              courseSeriesId: o.seriesId,
              courseDate: o.originalDate,
            },
          })
        }
        style={({ pressed }) => ({
          marginTop: spacing.xs,
          minHeight: 46,
          borderRadius: radius.md,
          backgroundColor: colors.onPrimary,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Feather name="file-text" size={18} color={colors.primary} />
        <AppText variant="bodyStrong" color="primary">
          {t('notes.takeNotes')}
        </AppText>
      </Pressable>
    </Pressable>
  );
}
