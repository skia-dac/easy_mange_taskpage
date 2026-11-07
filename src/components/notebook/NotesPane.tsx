import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NoteCard } from '@/components/NoteCard';
import { ProfileButton } from '@/components/ProfileButton';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listNoteCategories, listNotes, searchNotes } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme } from '@/shared/theme';
import {
  ChoiceChips,
  ChoiceSheet,
  EmptyState,
  Fab,
  loadStateOf,
  RiseIn,
  Screen,
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
  const notes = useLiveQuery(
    (db) => (trimmed ? searchNotes(db, trimmed) : listNotes(db)),
    ['notes'],
    [trimmed],
  );

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
  const favorites = list.filter((n) => n.isFavorite);
  const recent = trimmed ? list : list.filter((n) => !n.isFavorite);

  // Très grand texte : une note par ligne, pour que le titre et l'aperçu restent lisibles.
  const large = useLargeText();
  const grid = (items: typeof list) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((n) => (
        <RiseIn row key={n.id} style={{ width: large ? '100%' : '48%', flexGrow: 1 }}>
          <NoteCard
            note={n}
            subject={n.subjectId ? byId.get(n.subjectId) : undefined}
            category={n.categoryId ? catById.get(n.categoryId) : undefined}
          />
        </RiseIn>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen stagger title={title} actions={<ProfileButton />}>
        {switcher ? <RiseIn>{switcher}</RiseIn> : null}
        <RiseIn>
          <SearchInput value={query} onChangeText={setQuery} placeholder={t('notes.search')} />
        </RiseIn>
        <RiseIn>
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
        </RiseIn>

        {notesState !== 'ready' ? (
          <StateView state={notesState} onRetry={notes.retry} />
        ) : list.length === 0 ? (
          trimmed ? (
            <EmptyState icon="search" title={t('notes.noResults')} />
          ) : (
            <EmptyState icon="file-text" title={t('notes.empty')} message={t('notes.emptyHint')} />
          )
        ) : null}
        {favorites.length > 0 && !trimmed ? (
          <>
            <RiseIn>
              <SectionHeader title={t('notes.favorites')} />
            </RiseIn>
            {grid(favorites)}
          </>
        ) : null}
        {recent.length > 0 ? (
          <>
            <RiseIn>
              <SectionHeader title={trimmed ? t('notes.title') : t('notes.recent')} />
            </RiseIn>
            {grid(recent)}
          </>
        ) : null}
        <View style={{ height: 80 }} />
      </Screen>
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
