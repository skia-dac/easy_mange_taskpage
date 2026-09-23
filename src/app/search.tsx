import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { EventRow, ExamRow, WorkRow } from '@/components/AgendaRows';
import { NoteCard } from '@/components/NoteCard';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { useLiveQuery } from '@/shared/db';
import { fonts, minTouchSize, useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  EmptyState,
  ListRow,
  SectionHeader,
  SubjectBar,
  SubjectDot,
} from '@/shared/ui';
import { countResults, emptyResults, MIN_QUERY_LENGTH, searchAll } from '@/workflows';

const TABLES = [
  'subjects',
  'course_series',
  'notes',
  'assignments',
  'tasks',
  'exams',
  'personal_events',
];

/** Recherche globale (§81–83) : résultats regroupés par type. */
export default function SearchScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const now = useNow();
  const { colors, radius, spacing } = useTheme();
  const [query, setQuery] = useState('');
  const { byId } = useSubjects();
  const trimmed = query.trim();
  const results = useLiveQuery(
    (db) =>
      trimmed.length >= MIN_QUERY_LENGTH ? searchAll(db, trimmed) : Promise.resolve(emptyResults),
    TABLES,
    [trimmed],
  );
  const r = results.data ?? emptyResults;
  const total = countResults(r);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t('search.title') }} />
      <View style={{ padding: spacing.xl, paddingBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: minTouchSize + 6,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.primary,
            paddingHorizontal: spacing.md,
          }}
        >
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel={t('search.title')}
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('search.placeholder')}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={{
              flex: 1,
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: 16,
              minHeight: minTouchSize,
            }}
          />
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.xl,
          paddingTop: 0,
          gap: spacing.md,
          paddingBottom: spacing.xxl * 2,
        }}
      >
        {trimmed.length < MIN_QUERY_LENGTH ? (
          <AppText color="muted">{t('search.hint')}</AppText>
        ) : !results.loading && total === 0 ? (
          <EmptyState icon="search" title={t('search.noResults', { query: trimmed })} />
        ) : null}

        {r.subjects.length > 0 ? (
          <>
            <SectionHeader title={t('search.subjects')} />
            <Card>
              {r.subjects.map((s) => (
                <ListRow
                  key={s.id}
                  title={s.name}
                  subtitle={[s.code, s.teacher, s.room].filter(Boolean).join(' · ')}
                  leading={<SubjectDot color={colorOf(s)} size={14} />}
                  onPress={() => router.push({ pathname: '/subjects/[id]', params: { id: s.id } })}
                />
              ))}
            </Card>
          </>
        ) : null}

        {r.courses.length > 0 ? (
          <>
            <SectionHeader title={t('search.courses')} />
            <Card>
              {r.courses.map((c) => {
                const subject = byId.get(c.subjectId);
                return (
                  <ListRow
                    key={c.id}
                    title={c.title ?? subject?.name ?? ''}
                    subtitle={[
                      c.recurrence === 'weekly'
                        ? t('courses.every', { weekday: labels.weekday(c.weekday) })
                        : c.validFrom,
                      `${c.startTime} – ${c.endTime}`,
                      c.room,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    leading={<SubjectBar color={colorOf(subject)} />}
                    onPress={() => router.push({ pathname: '/courses/[id]', params: { id: c.id } })}
                  />
                );
              })}
            </Card>
          </>
        ) : null}

        {r.notes.length > 0 ? (
          <>
            <SectionHeader title={t('search.notes')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {r.notes.map((n) => (
                <View key={n.id} style={{ width: '48%', flexGrow: 1 }}>
                  <NoteCard note={n} subject={n.subjectId ? byId.get(n.subjectId) : undefined} />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {r.assignments.length > 0 ? (
          <>
            <SectionHeader title={t('search.assignments')} />
            <Card>
              {r.assignments.map((w) => (
                <WorkRow key={w.id} item={w} subjects={byId} now={now} showDate />
              ))}
            </Card>
          </>
        ) : null}

        {r.tasks.length > 0 ? (
          <>
            <SectionHeader title={t('search.tasks')} />
            <Card>
              {r.tasks.map((w) => (
                <WorkRow key={w.id} item={w} subjects={byId} now={now} showDate />
              ))}
            </Card>
          </>
        ) : null}

        {r.exams.length > 0 ? (
          <>
            <SectionHeader title={t('search.exams')} />
            <Card>
              {r.exams.map((e) => (
                <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
              ))}
            </Card>
          </>
        ) : null}
        {r.events.length > 0 ? (
          <>
            <SectionHeader title={t('search.events')} />
            <Card>
              {r.events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
