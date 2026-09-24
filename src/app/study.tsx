import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { subjectOptions } from '@/components/SubjectOptions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { useWeekStart } from '@/hooks/useWeekStart';
import { colorOf } from '@/modules/academic';
import {
  endStudySession,
  getActiveStudySession,
  listStudySessions,
  plannedEnd,
  remainingSeconds,
  startStudySession,
  studyPresets,
  studyTotals,
  type StudyKind,
} from '@/modules/productivity';
import { addDaysIso, startOfWeekOn, toIsoDate, weekdayOrder } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDuration } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  ListRow,
  SectionHeader,
  SelectField,
  showError,
  SubjectDot,
  TextButton,
} from '@/shared/ui';

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Minuteur de révision façon Pomodoro, lié à une matière, avec le temps cumulé de la semaine. */
export default function StudyScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const now = useNow(1000);
  const { colors, spacing, radius } = useTheme();
  const { subjects, byId } = useSubjects();
  const weekStartDay = useWeekStart();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [preset, setPreset] = useState(0);

  const active = useLiveQuery(getActiveStudySession, ['study_sessions'], []);
  const session = active.data ?? null;
  const today = toIsoDate(now);
  const weekFrom = startOfWeekOn(today, weekStartDay);
  const weekTo = addDaysIso(weekFrom, 6);
  const sessions = useLiveQuery(
    (d) => listStudySessions(d, weekFrom, weekTo),
    ['study_sessions'],
    [weekFrom, weekTo],
  );
  const totals = useMemo(
    () => studyTotals(sessions.data ?? [], weekFrom, weekTo, now),
    [sessions.data, weekFrom, weekTo, now],
  );

  const remaining = session ? remainingSeconds(session, now) : 0;
  const finished = session !== null && remaining === 0;
  // Dernière session close (la liste est triée de la plus récente à la plus ancienne).
  const last = (sessions.data ?? []).find((s) => s.endedAt !== null) ?? null;
  const lastKind: StudyKind = last?.kind ?? 'break';
  const justFinished =
    last !== null && now.getTime() - new Date(last.endedAt ?? 0).getTime() < 10 * 60_000;

  // Le minuteur est arrivé au bout (app ouverte) : on clôt la session à son heure prévue.
  useEffect(() => {
    if (!session || !finished) return;
    endStudySession(db, session.id, plannedEnd(session).toISOString()).catch((e: unknown) =>
      showError(userMessageKey(e)),
    );
  }, [db, session, finished]);

  const start = (kind: StudyKind) => {
    const p = studyPresets[preset] ?? studyPresets[0];
    startStudySession(db, {
      subjectId: kind === 'focus' ? subjectId : null,
      startedAt: new Date().toISOString(),
      plannedMinutes: kind === 'focus' ? p.work : p.rest,
      kind,
    }).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const stop = () => {
    if (!session) return;
    endStudySession(db, session.id).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const subject = session?.subjectId ? byId.get(session.subjectId) : null;
  const chartBars = weekdayOrder(weekStartDay).map((n, i) => {
    const day = addDaysIso(weekFrom, i);
    return {
      label: labels.weekday(n, 'short'),
      value: Math.round(totals.byDay.get(day) ?? 0),
      tone: day === today ? ('primary' as const) : ('muted' as const),
    };
  });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('study.title') }} />

      {session && !finished ? (
        <View
          style={{
            backgroundColor: session.kind === 'break' ? colors.successSoft : colors.primarySoft,
            borderRadius: radius.xl,
            padding: spacing.xxl,
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <AppText variant="label" color={session.kind === 'break' ? 'success' : 'primary'}>
            {(session.kind === 'break'
              ? t('study.breakRunning')
              : t('study.focusRunning')
            ).toLocaleUpperCase()}
          </AppText>
          <AppText variant="title" style={{ fontSize: 64, lineHeight: 72 }}>
            {clock(remaining)}
          </AppText>
          {subject ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <SubjectDot color={colorOf(subject)} size={10} />
              <AppText color="muted">{subject.name}</AppText>
            </View>
          ) : null}
          <AppText variant="caption" color="muted">
            {t('study.focusHint')}
          </AppText>
          <TextButton label={t('study.stop')} color="danger" onPress={stop} />
        </View>
      ) : (
        <Card>
          <View style={{ gap: spacing.md }}>
            {justFinished ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="check-circle" size={20} color={colors.success} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {lastKind === 'focus' ? t('study.done') : t('study.breakDone')}
                </AppText>
              </View>
            ) : null}
            <SelectField
              label={t('study.subject')}
              value={subjectId}
              noneLabel={t('work.noSubject')}
              options={subjectOptions(subjects)}
              onChange={setSubjectId}
            />
            <ChoiceChips
              label={t('study.preset')}
              options={studyPresets.map((p, i) => ({
                value: i,
                label: t('study.presetLabel', { work: p.work, rest: p.rest }),
              }))}
              selected={[preset]}
              onToggle={setPreset}
            />
            <Button label={t('study.start')} onPress={() => start('focus')} />
            {lastKind === 'focus' ? (
              <TextButton label={t('study.startBreak')} onPress={() => start('break')} />
            ) : null}
          </View>
        </Card>
      )}

      <SectionHeader
        title={t('study.week')}
        action={{ label: t('stats.title'), onPress: () => router.push('/stats') }}
      />
      <Card>
        <ListRow
          title={formatDuration(Math.round(totals.totalMinutes))}
          subtitle={t('study.weekTotal')}
          leading={<Feather name="clock" size={22} color={colors.primary} />}
        />
        <BarChart
          bars={chartBars}
          max={Math.max(60, ...chartBars.map((b) => b.value))}
          height={90}
          valueLabel={(v) => (v > 0 ? formatDuration(v) : '')}
          accessibilityLabel={t('study.weekChart')}
        />
        {totals.bySubject.map((row) => {
          const s = row.subjectId ? byId.get(row.subjectId) : undefined;
          return (
            <ListRow
              key={row.subjectId ?? 'none'}
              title={s?.name ?? t('work.noSubject')}
              leading={<SubjectDot color={colorOf(s)} size={12} />}
              trailing={
                <AppText variant="bodyStrong">{formatDuration(Math.round(row.minutes))}</AppText>
              }
            />
          );
        })}
      </Card>
    </ScrollView>
  );
}
