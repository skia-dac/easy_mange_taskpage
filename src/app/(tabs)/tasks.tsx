import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ExamRow, WorkRow } from '@/components/AgendaRows';
import { usePostpone } from '@/components/PostponeSheet';
import { ProfileButton } from '@/components/ProfileButton';
import { SearchButton } from '@/components/SearchButton';
import { SpaceFilter } from '@/components/SpaceUi';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, listExams } from '@/modules/academic';
import {
  compareWorkItems,
  isOverdue,
  listWorkItems,
  subtaskCounts,
  workSpace,
  type WorkItem,
  type WorkKind,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import type { SpaceId } from '@/shared/spaces';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  ChoiceChips,
  EmptyState,
  Fab,
  RiseIn,
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
  const spaces = useSpaces();
  const study = spaces.has('study');
  // Sans l'espace Études, il n'y a que des tâches (pas de devoirs ni d'examens).
  const [chosenTab, setTab] = useState<Tab>(study ? 'assignment' : 'task');
  const tab: Tab = study ? chosenTab : 'task';
  const [space, setSpace] = useState<SpaceId | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { subjects, byId } = useSubjects();

  const work = useLiveQuery(
    (db) => (tab === 'exam' ? Promise.resolve([]) : listWorkItems(db, tab as WorkKind)),
    ['tasks', 'assignments'],
    [tab],
  );
  const exams = useLiveQuery(
    (db) => (study ? listExams(db) : Promise.resolve([])),
    ['exams'],
    [study],
  );
  const counts = useLiveQuery(subtaskCounts, ['work_subtasks'], []);
  const postpone = usePostpone();

  const filtered = useMemo(
    () =>
      (work.data ?? []).filter((w) => {
        const s = workSpace(w);
        // Éléments des espaces désactivés : cachés, jamais effacés.
        if (!spaces.has(s)) return false;
        if (tab === 'task' && space && s !== space) return false;
        return !subjectId || w.subjectId === subjectId;
      }),
    [work.data, subjectId, space, spaces, tab],
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
        <RiseIn>
          <SectionHeader title={title} />
        </RiseIn>
        <Card>
          {items.map((w) => (
            <RiseIn key={w.id}>
              <WorkRow
                item={w}
                subjects={byId}
                now={now}
                showDate
                onPostpone={postpone.open}
                progress={counts.data?.get(`${w.kind}:${w.id}`)}
              />
            </RiseIn>
          ))}
        </Card>
      </View>
    );

  const add = () =>
    tab === 'exam'
      ? router.push({ pathname: '/exams/form', params: subjectId ? { subjectId } : {} })
      : router.push({
          pathname: '/work/form',
          params: {
            kind: tab,
            ...(subjectId ? { subjectId } : {}),
            ...(tab === 'task' && space ? { space } : {}),
          },
        });

  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        stagger
        title={t('tasks.title')}
        actions={
          <>
            <SearchButton />
            <ProfileButton />
          </>
        }
      >
        {study ? (
          <RiseIn>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'task', label: t('tasks.segTasks') },
                { value: 'assignment', label: t('tasks.segAssignments') },
                { value: 'exam', label: t('tasks.segExams') },
              ]}
            />
          </RiseIn>
        ) : null}
        {tab === 'task' ? (
          <RiseIn>
            <SpaceFilter
              value={space}
              onChange={(v) => {
                setSpace(v);
                if (v !== 'study') setSubjectId(null);
              }}
            />
          </RiseIn>
        ) : null}
        {subjects.length > 0 && study && (tab !== 'task' || space === null || space === 'study') ? (
          <RiseIn>
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
          </RiseIn>
        ) : null}

        {tab === 'exam' ? (
          examList.length === 0 ? (
            <EmptyState icon="award" title={t('tasks.noExams')} message={t('tasks.noExamsHint')} />
          ) : (
            <>
              {upcomingExams.length > 0 ? (
                <>
                  <RiseIn>
                    <SectionHeader title={t('tasks.groupUpcoming')} />
                  </RiseIn>
                  <Card>
                    {upcomingExams.map((e) => (
                      <RiseIn key={e.id}>
                        <ExamRow exam={e} subjects={byId} now={now} />
                      </RiseIn>
                    ))}
                  </Card>
                </>
              ) : null}
              {pastExams.length > 0 ? (
                <>
                  <RiseIn>
                    <SectionHeader title={t('tasks.groupPast')} />
                  </RiseIn>
                  <Card>
                    {pastExams.map((e) => (
                      <RiseIn key={e.id}>
                        <ExamRow exam={e} subjects={byId} now={now} />
                      </RiseIn>
                    ))}
                  </Card>
                </>
              ) : null}
            </>
          )
        ) : (
          <>
            {openCount > 0 ? (
              <RiseIn>
                <AppText variant="caption" color="muted">
                  {t('tasks.swipeHint')}
                </AppText>
              </RiseIn>
            ) : null}
            {!work.loading && openCount === 0 ? (
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
      {postpone.sheet}
    </View>
  );
}
