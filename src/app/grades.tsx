import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  colorOf,
  formatGrade,
  gradesBySubject,
  listExams,
  overallAverage,
} from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Card, EmptyState, ListRow, SectionHeader, SubjectDot } from '@/shared/ui';

/** Notes obtenues aux examens : moyenne générale, moyenne et évolution par matière. */
export default function GradesScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing, radius } = useTheme();
  const { subjects, byId } = useSubjects();
  const exams = useLiveQuery(listExams, ['exams'], []);
  const list = useMemo(() => exams.data ?? [], [exams.data]);
  const bySubject = useMemo(() => gradesBySubject(list), [list]);
  const graded = bySubject.filter((s) => s.average !== null);
  const overall = overallAverage(bySubject);
  const gradedCount = list.filter((e) => e.grade !== null).length;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      {!exams.loading && gradedCount === 0 ? (
        <EmptyState icon="award" title={t('grades.empty')} message={t('grades.emptyHint')} />
      ) : null}
      {overall !== null ? (
        <View
          style={{
            backgroundColor: colors.primarySoft,
            borderRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.xs,
          }}
        >
          <AppText variant="label" color="primary" style={{ letterSpacing: 1 }}>
            {t('grades.overall').toLocaleUpperCase()}
          </AppText>
          <AppText variant="title" style={{ fontSize: 40, lineHeight: 46 }}>
            {t('grades.on20', { value: formatGrade(overall, labels.lang) })}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('grades.overallHint', { count: gradedCount })}
          </AppText>
        </View>
      ) : null}

      {graded.map((g) => {
        const subject = byId.get(g.subjectId);
        const color = colorOf(subject);
        return (
          <View key={g.subjectId} style={{ gap: spacing.sm }}>
            <SectionHeader
              title={subject?.name ?? ''}
              action={
                subject
                  ? {
                      label: t('common.seeAll'),
                      onPress: () =>
                        router.push({ pathname: '/subjects/[id]', params: { id: subject.id } }),
                    }
                  : undefined
              }
            />
            <Card>
              <ListRow
                title={t('grades.on20', { value: formatGrade(g.average ?? 0, labels.lang) })}
                subtitle={t('grades.subjectAverage', { count: g.graded })}
                leading={<SubjectDot color={color} size={14} />}
              />
              {g.history.length > 1 ? (
                <BarChart
                  max={20}
                  bars={g.history.map((h) => ({
                    label: formatShortDate(h.date, labels.lang),
                    value: h.value,
                    tone: h.value < 10 ? 'danger' : 'primary',
                  }))}
                  valueLabel={(v) => formatGrade(v, labels.lang)}
                  accessibilityLabel={t('grades.chart', { subject: subject?.name ?? '' })}
                />
              ) : null}
              {g.history.map((h) => (
                <ListRow
                  key={h.examId}
                  title={h.title ?? t('exams.detailTitle')}
                  subtitle={formatShortDate(h.date, labels.lang)}
                  trailing={
                    <AppText variant="bodyStrong" color={h.value < 10 ? 'danger' : 'text'}>
                      {t('grades.on20', { value: formatGrade(h.value, labels.lang) })}
                    </AppText>
                  }
                  onPress={() => router.push({ pathname: '/exams/[id]', params: { id: h.examId } })}
                />
              ))}
            </Card>
          </View>
        );
      })}
      {subjects.length > 0 && gradedCount > 0 ? (
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {t('grades.howTo')}
        </AppText>
      ) : null}
    </ScrollView>
  );
}
