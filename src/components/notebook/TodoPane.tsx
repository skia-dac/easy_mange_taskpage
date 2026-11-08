import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ExamRow, WorkRow } from '@/components/AgendaRows';
import { usePostpone } from '@/components/PostponeSheet';
import { ProfileButton } from '@/components/ProfileButton';
import { SearchButton } from '@/components/SearchButton';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf, listExams, type Exam } from '@/modules/academic';
import {
  compareWorkItems,
  isOverdue,
  isWorkVisible,
  listWorkItems,
  subtaskCounts,
  type WorkItem,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  CardSegment,
  cardPosition,
  ChoiceChips,
  ChoiceSheet,
  EmptyState,
  Fab,
  FAB_CLEARANCE,
  ListItemMotion,
  ListScreen,
  loadStateOf,
  SectionHeader,
  StateView,
  SubjectDot,
  TextButton,
  type CardPosition,
} from '@/shared/ui';

export type TodoTab = 'task' | 'exam';
type Tab = TodoTab;

/** Tâches terminées montrées d'un coup ; « Voir plus » en ajoute autant. */
export const DONE_PAGE = 20;

type Entry =
  | { kind: 'header'; key: string; title: string }
  | { kind: 'work'; key: string; item: WorkItem; pos: CardPosition }
  | { kind: 'exam'; key: string; exam: Exam; pos: CardPosition }
  | { kind: 'hint' | 'empty' | 'doneToggle'; key: string };

/** Sous-onglet d'un lien `tab=` ; l'ancien `assignment` ouvre les tâches (devoirs compris). */
export function todoTabOf(value: unknown): TodoTab | undefined {
  if (value === 'exam') return 'exam';
  return value === 'task' || value === 'assignment' ? 'task' : undefined;
}

type Props = {
  /** Titre de l'écran (celui de l'onglet). */
  title: string;
  /** Sélecteur de vue affiché en haut du contenu. */
  switcher?: ReactNode;
  /** Sous-onglet demandé par un lien (`tab=`). */
  initialTab?: TodoTab;
};

/**
 * Vue « À faire » du Carnet. « Tâches » réunit les tâches et, avec Études, les devoirs
 * (une tâche avec une matière) ; « Examens » n'existe qu'avec Études.
 */
export function TodoPane({ title, switcher, initialTab }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const now = useNow();
  const today = toIsoDate(now);
  const spaces = useSpaces();
  const study = spaces.has('study');
  // Sans l'espace Études, il n'y a que des tâches (pas de devoirs ni d'examens).
  const [chosenTab, setTab] = useState<Tab>(initialTab ?? 'task');
  const tab: Tab = study ? chosenTab : 'task';
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE);
  const [subjectSheet, setSubjectSheet] = useState(false);
  const { subjects, byId } = useSubjects();

  const work = useLiveQuery(
    async (db) => {
      if (tab === 'exam') return [];
      const [tasks, assignments] = await Promise.all([
        listWorkItems(db, 'task'),
        study ? listWorkItems(db, 'assignment') : Promise.resolve([]),
      ]);
      return [...tasks, ...assignments];
    },
    ['tasks', 'assignments'],
    [tab, study],
  );
  const exams = useLiveQuery(
    (db) => (study ? listExams(db) : Promise.resolve([])),
    ['exams'],
    [study],
  );
  const counts = useLiveQuery(subtaskCounts, ['work_subtasks'], []);
  const postpone = usePostpone();
  // Chargement ou échec de la liste affichée : jamais une liste vide trompeuse.
  const listQuery = tab === 'exam' ? exams : work;
  const listState = loadStateOf(listQuery);
  const subject = subjectId ? byId.get(subjectId) : undefined;

  const filtered = useMemo(
    () =>
      (work.data ?? []).filter((w) => {
        // Un devoir n'existe qu'avec Études ; une tâche est commune aux trois espaces.
        if (!isWorkVisible(w, spaces.active)) return false;
        return !study || !subjectId || w.subjectId === subjectId;
      }),
    [work.data, subjectId, spaces, study],
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

  const add = () =>
    tab === 'exam'
      ? router.push({ pathname: '/exams/form', params: subjectId ? { subjectId } : {} })
      : router.push({
          pathname: '/work/form',
          params: study && subjectId ? { subjectId } : {},
        });

  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length;

  // Liste à plat (titres, lignes, boutons) pour une liste virtualisée : seules les lignes
  // proches de l'écran sont montées, même avec des centaines de tâches terminées.
  const entries: Entry[] = [];
  const workSection = (key: string, title: string, items: readonly WorkItem[]) => {
    if (items.length === 0) return;
    entries.push({ kind: 'header', key: `h:${key}`, title });
    items.forEach((item, i) =>
      entries.push({
        kind: 'work',
        key: `${key}:${item.kind}:${item.id}`,
        item,
        pos: cardPosition(i, items.length),
      }),
    );
  };
  const examSection = (key: string, title: string, items: readonly Exam[]) => {
    if (items.length === 0) return;
    entries.push({ kind: 'header', key: `h:${key}`, title });
    items.forEach((exam, i) =>
      entries.push({
        kind: 'exam',
        key: `${key}:${exam.id}`,
        exam,
        pos: cardPosition(i, items.length),
      }),
    );
  };
  if (listState === 'ready' && tab === 'exam') {
    examSection('upcoming', t('tasks.groupUpcoming'), upcomingExams);
    examSection('past', t('tasks.groupPast'), pastExams);
  } else if (listState === 'ready') {
    entries.push(openCount > 0 ? { kind: 'hint', key: 'hint' } : { kind: 'empty', key: 'empty' });
    workSection('overdue', t('tasks.groupOverdue'), groups.overdue);
    workSection('today', t('tasks.groupToday'), groups.today);
    workSection('upcoming', t('tasks.groupUpcoming'), groups.upcoming);
    if (groups.done.length > 0) {
      entries.push({ kind: 'doneToggle', key: 'doneToggle' });
      if (showDone) {
        // Les plus récentes d'abord, par pages : le reste attend « Voir plus ».
        workSection('done', t('tasks.groupDone'), groups.done.slice(0, doneLimit));
      }
    }
  }

  const renderItem = ({ item: e, index }: { item: Entry; index: number }) => {
    const gap = (size: 'none' | 'sm' | 'lg', child: ReactNode, row = false) => (
      <View style={{ marginTop: size === 'none' ? 0 : spacing[size] }}>
        <ListItemMotion index={index} row={row}>
          {child}
        </ListItemMotion>
      </View>
    );
    const firstRow = (pos: CardPosition) => (pos === 'only' || pos === 'first' ? 'sm' : 'none');
    switch (e.kind) {
      case 'header':
        return gap('lg', <SectionHeader title={e.title} />);
      case 'work':
        return gap(
          firstRow(e.pos),
          <CardSegment position={e.pos}>
            <WorkRow
              item={e.item}
              subjects={byId}
              now={now}
              showDate
              onPostpone={postpone.open}
              progress={counts.data?.get(`${e.item.kind}:${e.item.id}`)}
            />
          </CardSegment>,
          true,
        );
      case 'exam':
        return gap(
          firstRow(e.pos),
          <CardSegment position={e.pos}>
            <ExamRow exam={e.exam} subjects={byId} now={now} />
          </CardSegment>,
          true,
        );
      case 'hint':
        return gap(
          'lg',
          <AppText variant="caption" color="muted">
            {t('tasks.swipeHint')}
          </AppText>,
        );
      case 'empty':
        return gap(
          'lg',
          <EmptyState
            icon="check-circle"
            title={t('tasks.empty')}
            message={t('tasks.emptyHint')}
          />,
        );
      case 'doneToggle':
        return gap(
          'lg',
          <TextButton
            label={
              showDone ? t('tasks.hideDone') : t('tasks.showDone', { count: groups.done.length })
            }
            onPress={() => {
              setShowDone(!showDone);
              setDoneLimit(DONE_PAGE);
            }}
          />,
        );
    }
  };

  // Terminées pas encore montrées : « Voir plus » sous la dernière (toujours la fin de la liste).
  const doneRemaining =
    listState === 'ready' && tab === 'task' && showDone ? groups.done.length - doneLimit : 0;

  const empty =
    listState !== 'ready' ? (
      <StateView state={listState} onRetry={listQuery.retry} />
    ) : tab === 'exam' && examList.length === 0 ? (
      <EmptyState icon="award" title={t('tasks.noExams')} message={t('tasks.noExamsHint')} />
    ) : null;

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        title={title}
        actions={
          <>
            <SearchButton />
            <ProfileButton />
          </>
        }
        header={
          switcher || study ? (
            <>
              {switcher}
              {study ? (
                // Une seule rangée de filtres : le type (tâches, examens) puis la matière (menu).
                <ChoiceChips<string>
                  scroll
                  accessibilityLabel={t('tasks.kindFilter')}
                  options={[
                    { value: 'task', label: t('tasks.segTasks') },
                    { value: 'exam', label: t('tasks.segExams') },
                    ...(subjects.length > 0
                      ? [
                          {
                            value: '__subject',
                            label: subject
                              ? t('tasks.subjectChip', { name: subject.name })
                              : t('tasks.subjectAll'),
                            leading: subject ? (
                              <SubjectDot color={colorOf(subject)} size={10} />
                            ) : null,
                          },
                        ]
                      : []),
                  ]}
                  selected={[tab, ...(subject ? ['__subject'] : [])]}
                  onToggle={(v) =>
                    v === '__subject'
                      ? setSubjectSheet(true)
                      : setTab(v === 'exam' ? 'exam' : 'task')
                  }
                />
              ) : null}
            </>
          ) : undefined
        }
        data={entries}
        keyExtractor={(e) => e.key}
        renderItem={renderItem}
        empty={empty}
        footer={
          doneRemaining > 0 ? (
            <TextButton
              label={t('common.showMore', { count: Math.min(doneRemaining, DONE_PAGE) })}
              onPress={() => setDoneLimit((n) => n + DONE_PAGE)}
            />
          ) : null
        }
        bottomSpace={FAB_CLEARANCE}
      />
      <Fab accessibilityLabel={tab === 'exam' ? t('exams.new') : t('work.newTask')} onPress={add} />
      {postpone.sheet}
      <ChoiceSheet
        visible={subjectSheet}
        title={t('tasks.subjectPick')}
        options={[
          {
            label: t('tasks.allSubjects'),
            selected: subjectId === null,
            onPress: () => setSubjectId(null),
          },
          ...subjects.map((s) => ({
            label: s.name,
            selected: s.id === subjectId,
            onPress: () => setSubjectId(s.id),
          })),
        ]}
        onClose={() => setSubjectSheet(false)}
      />
    </View>
  );
}
