import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ExamRow, WorkRow } from '@/components/AgendaRows';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, listExams } from '@/modules/academic';
import {
  compareWorkItems,
  isOverdue,
  listWorkItems,
  type WorkItem,
  type WorkKind,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { useNow } from '@/shared/useNow';
import {
  Card,
  ChoiceChips,
  EmptyState,
  Fab,
  Screen,
  SectionHeader,
  Segmented,
  SubjectDot,
  TextButton,
} from '@/shared/ui';

type Tab = 'task' | 'assignment' | 'exam';

export default function TasksScreen() {
  const { t } = useTranslation();
  const now = useNow();
  const today = toIsoDate(now);
  const [tab, setTab] = useState<Tab>('assignment');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { subjects, byId } = useSubjects();

  const work = useLiveQuery(
    (db) => (tab === 'exam' ? Promise.resolve([]) : listWorkItems(db, tab as WorkKind)),
    ['tasks', 'assignments'],
    [tab],
  );
  const exams = useLiveQuery(listExams, ['exams'], []);

  const filtered = useMemo(
    () => (work.data ?? []).filter((w) => !subjectId || w.subjectId === subjectId),
    [work.data, subjectId],
  );
  const groups = useMemo(() => {
    const open = filtered.filter((w) => w.status !== 'done').sort(compareWorkItems);
    return {
      overdue: open.filter((w) => isOverdue(w, now)),
      today: open.filter((w) => !isOverdue(w, now) && w.dueDate === today),
      upcoming: open.filter((w) => !isOverdue(w, now) && w.dueDate > today),
      done: filtered
        .filter((w) => w.status === 'done')
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')),
    };
  }, [filtered, now, today]);

  const examList = (exams.data ?? []).filter((e) => !subjectId || e.subjectId === subjectId);
  const upcomingExams = examList.filter((e) => e.date >= today);
  const pastExams = examList.filter((e) => e.date < today).reverse();

  const section = (title: string, items: WorkItem[]) =>
    items.length === 0 ? null : (
      <View key={title} style={{ gap: 8 }}>
        <SectionHeader title={title} />
        <Card>
          {items.map((w) => (
            <WorkRow key={w.id} item={w} subjects={byId} now={now} showDate />
          ))}
        </Card>
      </View>
    );

  const add = () =>
    tab === 'exam'
      ? router.push({ pathname: '/exams/form', params: subjectId ? { subjectId } : {} })
      : router.push({
          pathname: '/work/form',
          params: { kind: tab, ...(subjectId ? { subjectId } : {}) },
        });

  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length;

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t('tasks.title')}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'task', label: t('tasks.segTasks') },
            { value: 'assignment', label: t('tasks.segAssignments') },
            { value: 'exam', label: t('tasks.segExams') },
          ]}
        />
        {subjects.length > 0 ? (
          <ChoiceChips
            scroll
            options={[
              { value: null, label: t('tasks.allSubjects') },
              ...subjects.map((s) => ({
                value: s.id as string | null,
                label: s.name,
                leading: <SubjectDot color={colorOf(s)} size={10} />,
              })),
            ]}
            selected={[subjectId]}
            onToggle={setSubjectId}
          />
        ) : null}

        {tab === 'exam' ? (
          examList.length === 0 ? (
            <EmptyState icon="award" title={t('tasks.noExams')} message={t('tasks.noExamsHint')} />
          ) : (
            <>
              {upcomingExams.length > 0 ? (
                <>
                  <SectionHeader title={t('tasks.groupUpcoming')} />
                  <Card>
                    {upcomingExams.map((e) => (
                      <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
                    ))}
                  </Card>
                </>
              ) : null}
              {pastExams.length > 0 ? (
                <>
                  <SectionHeader title={t('tasks.groupPast')} />
                  <Card>
                    {pastExams.map((e) => (
                      <ExamRow key={e.id} exam={e} subjects={byId} now={now} />
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          )
        ) : (
          <>
            {openCount === 0 ? (
              <EmptyState
                icon="check-circle"
                title={t('tasks.empty')}
                message={tab === 'task' ? t('tasks.emptyHint') : t('tasks.emptyAssignmentsHint')}
              />
            ) : null}
            {section(t('tasks.groupOverdue'), groups.overdue)}
            {section(t('tasks.groupToday'), groups.today)}
            {section(t('tasks.groupUpcoming'), groups.upcoming)}
            {groups.done.length > 0 ? (
              <>
                <TextButton
                  label={
                    showDone
                      ? t('tasks.hideDone')
                      : t('tasks.showDone', { count: groups.done.length })
                  }
                  onPress={() => setShowDone(!showDone)}
                />
                {showDone ? section(t('tasks.groupDone'), groups.done) : null}
              </>
            ) : null}
          </>
        )}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab accessibilityLabel={t('add.title')} onPress={add} />
    </View>
  );
}
