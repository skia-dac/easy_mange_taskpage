import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NoteCard } from '@/components/NoteCard';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listNoteCategories, listNotes, searchNotes } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme } from '@/shared/theme';
import {
  ChoiceChips,
  EmptyState,
  Fab,
  RiseIn,
  Screen,
  SearchInput,
  SectionHeader,
  SubjectDot,
} from '@/shared/ui';

export default function NotesScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  // Les notes sont communes aux trois espaces ; on les range par catégories créées par l'utilisateur.
  const [categoryId, setCategoryId] = useState<string | null>(null);
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
  const favorites = list.filter((n) => n.isFavorite);
  const recent = trimmed ? list : list.filter((n) => !n.isFavorite);

  const grid = (items: typeof list) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((n) => (
        <RiseIn key={n.id} style={{ width: '48%', flexGrow: 1 }}>
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
      <Screen stagger title={t('notes.title')}>
        <RiseIn>
          <SearchInput value={query} onChangeText={setQuery} placeholder={t('notes.search')} />
        </RiseIn>
        <RiseIn>
          <ChoiceChips
            scroll
            options={[
              { value: null as string | null, label: t('noteCategories.all') },
              ...(categories.data ?? []).map((c) => ({
                value: c.id as string | null,
                label: c.name,
                leading: <SubjectDot color={colorOf({ colorId: c.colorId })} size={10} />,
              })),
              { value: '__manage', label: t('noteCategories.manage') },
            ]}
            selected={[categoryId]}
            onToggle={(v) =>
              v === '__manage' ? router.push('/notes/categories') : setCategoryId(v)
            }
          />
        </RiseIn>
        {subjects.length > 0 && spaces.has('study') ? (
          <RiseIn>
            <ChoiceChips
              scroll
              options={[
                { value: null, label: t('noteCategories.allSubjects') },
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

        {!notes.loading && list.length === 0 ? (
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
    </View>
  );
}
