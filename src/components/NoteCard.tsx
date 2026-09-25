import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { colorOf, type Subject } from '@/modules/academic';
import {
  noteDisplayTitle,
  notePreview,
  type Note,
  type NoteCategory,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Card, Chip } from '@/shared/ui';

/** Vignette d'une note dans la grille (§48, §52). */
export function NoteCard({
  note,
  subject,
  category,
}: {
  note: Note;
  subject?: Subject;
  category?: NoteCategory;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing } = useTheme();
  const title = noteDisplayTitle(note) || t('notes.empty2');
  return (
    <Card
      onPress={() => router.push({ pathname: '/notes/[id]', params: { id: note.id } })}
      accessibilityLabel={title}
      style={{ minHeight: 150, gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' }}>
        <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
          {title}
        </AppText>
        {note.isFavorite ? <Feather name="star" size={16} color={colors.warning} /> : null}
      </View>
      <AppText variant="caption" color="muted" numberOfLines={3} style={{ flex: 1 }}>
        {notePreview(note)}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: spacing.xs,
        }}
      >
        {subject ? (
          <Chip label={subject.name} subject={colorOf(subject)} />
        ) : category ? (
          <Chip label={category.name} subject={colorOf({ colorId: category.colorId })} />
        ) : (
          <View />
        )}
        <AppText variant="caption" color="muted">
          {formatShortDate(toIsoDate(new Date(note.updatedAt)), labels.lang)}
        </AppText>
      </View>
    </Card>
  );
}
