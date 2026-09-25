import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { NoteCard } from '@/components/NoteCard';
import { SpaceFilter } from '@/components/SpaceUi';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listNotes, noteSpace, searchNotes } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import type { SpaceId } from '@/shared/spaces';
import { useTheme } from '@/shared/theme';
import {
  ChoiceChips,
  EmptyState,
  Fab,
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
  const [space, setSpace] = useState<SpaceId | null>(null);
  const spaces = useSpaces();
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
        const s = noteSpace(n);
        // Notes des espaces désactivés : cachées, jamais effacées.
        if (!spaces.has(s)) return false;
        if (space && s !== space) return false;
        return !subjectId || n.subjectId === subjectId;
      }),
    [notes.data, subjectId, space, spaces],
  );
  const favorites = list.filter((n) => n.isFavorite);
  const recent = trimmed ? list : list.filter((n) => !n.isFavorite);

  const grid = (items: typeof list) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      {items.map((n) => (
        <View key={n.id} style={{ width: '48%', flexGrow: 1 }}>
          <NoteCard note={n} subject={n.subjectId ? byId.get(n.subjectId) : undefined} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen title={t('notes.title')}>
        <SearchInput value={query} onChangeText={setQuery} placeholder={t('notes.search')} />
        <SpaceFilter
          value={space}
          onChange={(v) => {
            setSpace(v);
            if (v !== 'study') setSubjectId(null);
          }}
        />
        {subjects.length > 0 && spaces.has('study') && (space === null || space === 'study') ? (
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

        {!notes.loading && list.length === 0 ? (
          trimmed ? (
            <EmptyState icon="search" title={t('notes.noResults')} />
          ) : (
            <EmptyState icon="file-text" title={t('notes.empty')} message={t('notes.emptyHint')} />
          )
        ) : null}
        {favorites.length > 0 && !trimmed ? (
          <>
            <SectionHeader title={t('notes.favorites')} />
            {grid(favorites)}
          </>
        ) : null}
        {recent.length > 0 ? (
          <>
            <SectionHeader title={trimmed ? t('notes.title') : t('notes.recent')} />
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
              ...(space ? { space } : {}),
            },
          })
        }
      />
    </View>
  );
}
