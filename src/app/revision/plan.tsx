import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { getExam } from '@/modules/academic';
import {
  defaultPlanOptions,
  planRevisions,
  useAgendaData,
  type ProposedBlock,
} from '@/projections';
import { toIsoDate, toTime } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  DateTimeField,
  EmptyState,
  ListRow,
  SectionHeader,
  showError,
  LoadingScreen,
} from '@/shared/ui';
import { saveRevisionPlan } from '@/workflows';

const SESSION_CHOICES = [2, 3, 4, 5, 6, 8, 10] as const;
const MINUTE_CHOICES = [30, 45, 60, 90, 120] as const;
const DAY_CHOICES = [3, 5, 7, 10, 14] as const;

type Options = {
  sessions: number;
  minutes: number;
  daysBefore: number;
  windowStart: string;
  windowEnd: string;
};

/**
 * Plan de révision avant un examen : l'app propose des séances dans les créneaux libres,
 * l'étudiant retire celles qui ne lui vont pas, puis valide. Rien n'est enregistré avant.
 */
export default function RevisionPlanScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const { byId } = useSubjects();
  const exam = useLiveQuery((d) => getExam(d, examId), ['exams'], [examId]);
  const agenda = useAgendaData({ allSpaces: true });
  const today = toIsoDate(new Date());

  // Réglages choisis par l'étudiant ; sinon valeurs proposées selon le temps avant l'examen.
  const [chosen, setChosen] = useState<Partial<Options>>({});
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const e = exam.data;
  const defaults = e ? defaultPlanOptions(e.date, today) : null;
  const opts: Options = {
    sessions: 3,
    minutes: 60,
    daysBefore: 7,
    windowStart: '17:00',
    windowEnd: '21:00',
    ...defaults,
    ...chosen,
  };
  const { sessions, minutes, daysBefore, windowStart, windowEnd } = opts;
  // Changer un réglage refait la proposition : les séances retirées l'étaient pour l'ancienne.
  const choose = (patch: Partial<Options>) => {
    setChosen((c) => ({ ...c, ...patch }));
    setRemoved(new Set());
  };

  const existing = useMemo(
    () => (agenda.data?.revisionBlocks ?? []).filter((b) => b.examId === examId),
    [agenda.data, examId],
  );
  const plannedCount = existing.filter((b) => b.status === 'planned').length;

  const plan = useMemo(() => {
    if (!e || !agenda.data) return null;
    // Le plan remplace les séances encore prévues de cet examen : elles ne bloquent pas les créneaux.
    const data = {
      ...agenda.data,
      revisionBlocks: (agenda.data.revisionBlocks ?? []).filter(
        (b) => !(b.examId === examId && b.status === 'planned'),
      ),
    };
    return planRevisions(data, {
      examDate: e.date,
      today,
      nowTime: toTime(new Date()),
      sessions,
      minutes,
      daysBefore,
      windowStart,
      windowEnd,
    });
  }, [e, agenda.data, examId, today, sessions, minutes, daysBefore, windowStart, windowEnd]);

  if (exam.loading || agenda.loading) return <LoadingScreen />;
  if (!e) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;
  if (e.date <= today)
    return (
      <EmptyState
        icon="calendar"
        title={t('revision.tooLate')}
        message={t('revision.tooLateHint')}
      />
    );

  const subject = byId.get(e.subjectId);
  const key = (b: ProposedBlock) => `${b.date}|${b.startTime}`;
  const kept = (plan?.blocks ?? []).filter((b) => !removed.has(key(b)));

  const save = () => {
    setSaving(true);
    saveRevisionPlan(db, {
      examId: e.id,
      subjectId: e.subjectId,
      timetableName: t('revision.timetableName'),
      blocks: kept,
      replacePlanned: true,
    }).then(
      () => router.back(),
      (err: unknown) => {
        setSaving(false);
        showError(userMessageKey(err));
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('revision.planTitle') }} />
      <AppText variant="heading">
        {t('revision.planFor', {
          subject: subject?.name ?? '',
          date: formatShortDate(e.date, labels.lang),
        })}
      </AppText>
      <AppText color="muted">{t('revision.planHint')}</AppText>

      <Card>
        <View style={{ gap: spacing.md }}>
          <ChoiceChips
            label={t('revision.sessions')}
            options={SESSION_CHOICES.map((n) => ({ value: n, label: String(n) }))}
            selected={[sessions]}
            onToggle={(v) => choose({ sessions: v })}
          />
          <ChoiceChips
            label={t('revision.duration')}
            options={MINUTE_CHOICES.map((n) => ({ value: n, label: labels.duration(n) }))}
            selected={[minutes]}
            onToggle={(v) => choose({ minutes: v })}
          />
          <ChoiceChips
            label={t('revision.daysBefore')}
            options={DAY_CHOICES.map((n) => ({
              value: n,
              label: t('revision.days', { count: n }),
            }))}
            selected={[daysBefore]}
            onToggle={(v) => choose({ daysBefore: v })}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('revision.from')}
                mode="time"
                value={windowStart}
                onChange={(v) => v && choose({ windowStart: v })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('revision.to')}
                mode="time"
                value={windowEnd}
                onChange={(v) => v && choose({ windowEnd: v })}
              />
            </View>
          </View>
        </View>
      </Card>

      <SectionHeader title={t('revision.proposal', { count: kept.length })} />
      {plan && plan.missing > 0 ? (
        <AppText color="warning">{t('revision.missing', { count: plan.missing })}</AppText>
      ) : null}
      {kept.length === 0 ? (
        <AppText color="muted">{t('revision.noSlot')}</AppText>
      ) : (
        <Card>
          {kept.map((b) => (
            <ListRow
              key={key(b)}
              title={formatShortDate(b.date, labels.lang)}
              subtitle={`${b.startTime} – ${b.endTime}`}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('revision.removeSlot')}
                  hitSlop={12}
                  onPress={() => setRemoved((r) => new Set([...r, key(b)]))}
                >
                  <Feather name="x" size={20} color={colors.muted} />
                </Pressable>
              }
            />
          ))}
        </Card>
      )}
      {plannedCount > 0 ? (
        <AppText variant="caption" color="muted">
          {t('revision.replaceInfo', { count: plannedCount })}
        </AppText>
      ) : null}
      <Button
        label={t('revision.validate', { count: kept.length })}
        onPress={save}
        disabled={saving || kept.length === 0}
      />
    </ScrollView>
  );
}
