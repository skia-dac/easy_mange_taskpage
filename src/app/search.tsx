import { router, Stack } from 'expo-router';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { EventRow, ExamRow, WorkRow } from '@/components/AgendaRows';
import { TransactionRow } from '@/components/money/TransactionRow';
import { NoteCard } from '@/components/NoteCard';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listCategories } from '@/modules/finance';
import { useLiveQuery } from '@/shared/db';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  EmptyState,
  ListRow,
  SearchInput,
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
  'money_transactions',
];

/** Recherche globale (§81–83) : résultats regroupés par type. */
export default function SearchScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const now = useNow();
  const { colors, spacing } = useTheme();
  const [query, setQuery] = useState('');
  const { byId } = useSubjects();
  // La frappe reste fluide : la recherche suit le texte avec un léger retard.
  const deferredQuery = useDeferredValue(query);
  const trimmed = deferredQuery.trim();
  const results = useLiveQuery(
    (db) =>
      trimmed.length >= MIN_QUERY_LENGTH ? searchAll(db, trimmed) : Promise.resolve(emptyResults),
    TABLES,
    [trimmed],
  );
  const r = results.data ?? emptyResults;
  // Catégories personnelles : pour nommer et colorer les opérations trouvées.
  const categories = useLiveQuery(listCategories, ['money_categories'], []);
  const total = countResults(r);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: t('search.title') }} />
      <View style={{ padding: spacing.xl, paddingBottom: spacing.sm }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoFocus
          emphasized
        />
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

        {r.transactions.length > 0 ? (
          <>
            <SectionHeader title={t('search.money')} />
            <Card>
              {r.transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  item={tx}
                  categories={categories.data ?? []}
                  lang={labels.lang}
                  showDate
                />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
