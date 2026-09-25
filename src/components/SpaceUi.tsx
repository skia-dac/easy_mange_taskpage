import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useSpaces } from '@/shared/SpacesContext';
import type { SpaceId } from '@/shared/spaces';
import { subjectColors, useTheme, type SubjectColor } from '@/shared/theme';
import { AppText, Chip, ChoiceChips, Segmented, SubjectDot } from '@/shared/ui';

const COLOR_OF: Record<SpaceId, string> = { study: 'violet', work: 'blue', personal: 'green' };

/** Couleur d'un espace : Études violet, Pro bleu, Perso vert (palette des matières). */
export function spaceColor(space: SpaceId): SubjectColor {
  return subjectColors.find((c) => c.id === COLOR_OF[space]) ?? subjectColors[0]!;
}

/** Petite étiquette de l'espace (affichée seulement quand plusieurs espaces sont actifs). */
export function SpaceTag({ space }: { space: SpaceId }) {
  const { t } = useTranslation();
  const { active } = useSpaces();
  if (active.length < 2) return null;
  return <Chip label={t(`spaces.short.${space}`)} subject={spaceColor(space)} />;
}

/** Filtre « Tout / Études / Pro / Perso » ; rien s'il n'y a qu'un espace actif. */
export function SpaceFilter({
  value,
  onChange,
}: {
  value: SpaceId | null;
  onChange: (value: SpaceId | null) => void;
}) {
  const { t } = useTranslation();
  const { active } = useSpaces();
  if (active.length < 2) return null;
  return (
    <ChoiceChips
      scroll
      options={[
        { value: null, label: t('spaces.all') },
        ...active.map((s) => ({
          value: s as SpaceId | null,
          label: t(`spaces.short.${s}`),
          leading: <SubjectDot color={spaceColor(s)} size={10} />,
        })),
      ]}
      selected={[value]}
      onToggle={onChange}
    />
  );
}

/**
 * Choix de l'espace dans un formulaire, parmi les espaces actifs. Masqué s'il n'y a qu'un
 * espace, ou quand l'élément est lié à une matière (il va alors toujours dans Études).
 */
export function SpacePicker({
  value,
  onChange,
  lockedToStudy = false,
  allowStudy = true,
}: {
  value: SpaceId;
  onChange: (value: SpaceId) => void;
  lockedToStudy?: boolean;
  /** false pour un élément qui n'a pas de sens en Études (ex. un événement perso). */
  allowStudy?: boolean;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { active } = useSpaces();
  const options = active.filter((s) => allowStudy || s !== 'study');
  if (lockedToStudy) {
    return active.length > 1 ? (
      <AppText variant="caption" color="muted">
        {t('spaces.lockedStudy')}
      </AppText>
    ) : null;
  }
  // L'espace enregistré reste proposé même s'il est désactivé : rien n'est changé en silence.
  const shown = options.includes(value) ? options : [...options, value];
  if (shown.length < 2) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" color="muted">
        {t('spaces.field').toLocaleUpperCase()}
      </AppText>
      <Segmented
        accessibilityLabel={t('spaces.field')}
        value={value}
        onChange={onChange}
        options={shown.map((s) => ({ value: s, label: t(`spaces.short.${s}`) }))}
      />
    </View>
  );
}
