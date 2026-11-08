import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NoteCard } from '@/components/NoteCard';
import { ProfileButton } from '@/components/ProfileButton';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listNoteCategories, listNoteSummaries, type Note } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme } from '@/shared/theme';
import {
  ChoiceChips,
  ChoiceSheet,
  EmptyState,
  Fab,
  FAB_CLEARANCE,
  ListItemMotion,
  ListScreen,
  loadStateOf,
  SearchInput,
  SectionHeader,
  StateView,
  SubjectDot,
  useLargeText,
} from '@/shared/ui';

type Props = {
  /** Titre de l'écran (celui de l'onglet). */
  title: string;
  /** Sélecteur de vue affiché en haut du contenu. */
  switcher?: ReactNode;
};

/** Une ligne de la liste virtualisée : un titre de groupe, ou une rangée de vignettes. */
type Entry =
  { kind: 'header'; key: string; title: string } | { kind: 'notes'; key: string; notes: Note[] };

/** Vue « Notes » du Carnet : notes communes aux trois espaces. */
export function NotesPane({ title, switcher }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  // Les notes sont communes aux trois espaces ; on les range par catégories créées par l'utilisateur.
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subjectSheet, setSubjectSheet] = useState(false);
  const spaces = useSpaces();
  const categories = useLiveQuery(listNoteCategories, ['note_categories'], []);
  const catById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  );
  const { subjects, byId } = useSubjects();
  const trimmed = query.trim();
  // Vignettes : le début du contenu seulement, jamais les longues notes en entier.
  const notes = useLiveQuery((db) => listNoteSummaries(db, trimmed), ['notes'], [trimmed]);

  const list = useMemo(
    () =>
      (notes.data ?? []).filter((n) => {
        if (categoryId && n.categoryId !== categoryId) return false;
        return !subjectId || n.subjectId === subjectId;
      }),
    [notes.data, subjectId, categoryId],
  );
  const notesState = loadStateOf(notes);
  const subjectFilter = spaces.has('study') && subjects.length > 0;
  const subject = subjectId ? byId.get(subjectId) : undefined;

  // Très grand texte : une note par ligne, pour que le titre et l'aperçu restent lisibles.
  const large = useLargeText();
  const perRow = large ? 1 : 2;
  const entries = useMemo(() => {
    const out: Entry[] = [];
    const group = (key: string, heading: string, items: Note[]) => {
      if (items.length === 0) return;
      out.push({ kind: 'header', key: `h:${key}`, title: heading });
      for (let i = 0; i < items.length; i += perRow) {
        const row = items.slice(i, i + perRow);
        out.push({ kind: 'notes', key: `${key}:${row.map((n) => n.id).join(':')}`, notes: row });
      }
    };
    if (!trimmed)
      group(
        'favorites',
        t('notes.favorites'),
        list.filter((n) => n.isFavorite),
      );
    group(
      'recent',
      trimmed ? t('notes.title') : t('notes.recent'),
      trimmed ? list : list.filter((n) => !n.isFavorite),
    );
    return out;
  }, [list, trimmed, perRow, t]);

  const renderItem = ({ item: e, index }: { item: Entry; index: number }) =>
    e.kind === 'header' ? (
      <View style={{ marginTop: spacing.lg }}>
        <ListItemMotion index={index}>
          <SectionHeader title={e.title} />
        </ListItemMotion>
      </View>
    ) : (
      <View style={{ marginTop: spacing.md }}>
        <ListItemMotion index={index} row>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {e.notes.map((n) => (
              // Une note seule sur sa rangée prend toute la largeur, comme dans l'ancienne grille.
              <View key={n.id} style={{ flex: 1 }}>
                <NoteCard
                  note={n}
                  subject={n.subjectId ? byId.get(n.subjectId) : undefined}
                  category={n.categoryId ? catById.get(n.categoryId) : undefined}
                />
              </View>
            ))}
          </View>
        </ListItemMotion>
      </View>
    );

  const empty =
    notesState !== 'ready' ? (
      <StateView state={notesState} onRetry={notes.retry} />
    ) : trimmed ? (
      <EmptyState icon="search" title={t('notes.noResults')} />
    ) : (
      <EmptyState icon="file-text" title={t('notes.empty')} message={t('notes.emptyHint')} />
    );

  return (
    <View style={{ flex: 1 }}>
      <ListScreen
        title={title}
        actions={<ProfileButton />}
        header={
          <>
            {switcher}
            <SearchInput value={query} onChangeText={setQuery} placeholder={t('notes.search')} />
            {/* Une seule rangée : la matière (menu, Études) puis les catégories. */}
            <ChoiceChips
              scroll
              accessibilityLabel={t('noteCategories.title')}
              options={[
                ...(subjectFilter
                  ? [
                      {
                        value: '__subject' as string | null,
                        label: subject
                          ? t('tasks.subjectChip', { name: subject.name })
                          : t('tasks.subjectAll'),
                        leading: subject ? <SubjectDot color={colorOf(subject)} size={10} /> : null,
                      },
                    ]
                  : []),
                { value: null as string | null, label: t('noteCategories.all') },
                ...(categories.data ?? []).map((c) => ({
                  value: c.id as string | null,
                  label: c.name,
                  leading: <SubjectDot color={colorOf({ colorId: c.colorId })} size={10} />,
                })),
                { value: '__manage', label: t('noteCategories.manage') },
              ]}
              selected={[categoryId, ...(subject ? ['__subject'] : [])]}
              onToggle={(v) =>
                v === '__manage'
                  ? router.push('/notes/categories')
                  : v === '__subject'
                    ? setSubjectSheet(true)
                    : setCategoryId(v)
              }
            />
          </>
        }
        data={notesState === 'ready' ? entries : []}
        keyExtractor={(e) => e.key}
        renderItem={renderItem}
        empty={empty}
        bottomSpace={FAB_CLEARANCE}
      />
      <Fab
        accessibilityLabel={t('notes.new')}
        onPress={() =>
          router.push({
            pathname: '/notes/[id]',
            params: {
              id: 'new',
              ...(subjectId ? { subjectId } : {}),
              ...(categoryId ? { categoryId } : {}),
            },
          })
        }
      />
      <ChoiceSheet
        visible={subjectSheet}
        title={t('tasks.subjectPick')}
        options={[
          { label: t('noteCategories.allSubjects'), onPress: () => setSubjectId(null) },
          ...subjects.map((s) => ({ label: s.name, onPress: () => setSubjectId(s.id) })),
        ]}
        onClose={() => setSubjectSheet(false)}
      />
    </View>
  );
}
