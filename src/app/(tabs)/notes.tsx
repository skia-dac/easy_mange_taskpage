import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { NoteCard } from '@/components/NoteCard';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { listNotes, searchNotes } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { fonts, minTouchSize, useTheme } from '@/shared/theme';
import { ChoiceChips, EmptyState, Fab, Screen, SectionHeader, SubjectDot } from '@/shared/ui';

export default function NotesScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const { subjects, byId } = useSubjects();
  const trimmed = query.trim();
  const notes = useLiveQuery(
    (db) => (trimmed ? searchNotes(db, trimmed) : listNotes(db)),
    ['notes'],
    [trimmed],
  );

  const list = useMemo(
    () => (notes.data ?? []).filter((n) => !subjectId || n.subjectId === subjectId),
    [notes.data, subjectId],
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: minTouchSize + 4,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.md,
          }}
        >
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            accessibilityLabel={t('notes.search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('notes.search')}
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
            params: { id: 'new', ...(subjectId ? { subjectId } : {}) },
          })
        }
      />
    </View>
  );
}
