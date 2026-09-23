import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { CourseRow, EventRow, ExamRow, WorkRow } from '@/components/AgendaRows';
import { useSubjects } from '@/hooks/useSubjects';
import { buildToday, useAgendaData, type NextCourse } from '@/projections';
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
} from '@/shared/ui';

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const now = useNow();
  const agenda = useAgendaData();
  const { subjects, byId, loading } = useSubjects();
  const view = useMemo(
    () => (agenda.data ? buildToday(agenda.data, now) : null),
    [agenda.data, now],
  );

  const todo = view ? [...view.overdue, ...view.dueToday] : [];

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t('today.greeting')} subtitle={formatLongDate(now, i18n.language)}>
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

        {view?.next ? (
          <NextCourseCard
            next={view.next}
            subjectName={byId.get(view.next.occurrence.subjectId)?.name ?? ''}
          />
        ) : view ? (
          <EmptyState
            icon="sun"
            title={view.courses.length > 0 ? t('today.coursesDone') : t('today.emptyCourses')}
            message={
              view.courses.length > 0 || view.dayOff ? undefined : t('today.emptyCoursesHint')
            }
          />
        ) : null}

        {view && view.courses.length > 0 ? (
          <>
            <SectionHeader title={t('today.coursesTitle')} />
            <Card>
              {view.courses.map((o) => (
                <CourseRow key={`${o.seriesId}-${o.date}`} occurrence={o} subjects={byId} />
              ))}
            </Card>
          </>
        ) : null}

        {view ? (
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
                  />
                ))}
              </Card>
            ) : (
              <AppText color="muted">{t('today.nothingTodo')}</AppText>
            )}

            {view.events.length > 0 ? (
              <>
                <SectionHeader title={t('today.eventsTitle')} />
                <Card>
                  {view.events.map((e) => (
                    <EventRow key={e.id} event={e} />
                  ))}
                </Card>
              </>
            ) : null}

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
        ) : null}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab accessibilityLabel={t('add.title')} onPress={() => router.push('/add')} />
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
        router.push({ pathname: '/courses/[id]', params: { id: o.seriesId, date: o.date } })
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
    </Pressable>
  );
}
