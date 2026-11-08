import type { ReactNode } from 'react';
import { ScrollView, View, type AccessibilityRole } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { haptic } from './haptics';
import { AppText } from './AppText';
import { Tappable } from './Tappable';

type Option<T> = { value: T; label: string; leading?: ReactNode };

type Props<T> = {
  label?: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Sur une seule ligne qui défile (filtres), sinon sur plusieurs lignes. */
  scroll?: boolean;
  /** Nom du groupe pour le lecteur d'écran quand il n'a pas de `label` visible (filtres). */
  accessibilityLabel?: string;
};

type ChipProps = {
  label: string;
  on: boolean;
  onPress: () => void;
  leading?: ReactNode;
  /** « bouton » par défaut ; « onglet » quand la pastille change de vue (dans un `tablist`). */
  accessibilityRole?: AccessibilityRole;
  accessibilityHint?: string;
};

/** Une pastille : choisie, elle est pleine (couleur principale). */
export function ChoiceChip({
  label,
  on,
  onPress,
  leading,
  accessibilityRole = 'button',
  accessibilityHint,
}: ChipProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Tappable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected: on }}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptic('selection');
        onPress();
      }}
      style={{
        minHeight: minTouchSize,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: on ? colors.primary : colors.border,
        backgroundColor: on ? colors.primary : colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      {leading}
      <AppText variant="bodyStrong" color={on ? 'onPrimary' : 'text'}>
        {label}
      </AppText>
    </Tappable>
  );
}

/**
 * Pastilles à choisir (une ou plusieurs).
 *
 * Le nom du groupe est lu avec la PREMIÈRE pastille (en indication) : VoiceOver ignore le libellé
 * d'une vue qui n'est pas elle-même un élément, et rendre cette vue accessible en ferait un seul
 * élément qui cacherait les pastilles.
 */
export function ChoiceChips<T>({
  label,
  options,
  selected,
  onToggle,
  scroll,
  accessibilityLabel,
}: Props<T>) {
  const { spacing } = useTheme();
  const group = accessibilityLabel ?? label;
  const chips = options.map((o, i) => (
    <ChoiceChip
      key={i}
      label={o.label}
      leading={o.leading}
      on={selected.includes(o.value)}
      onPress={() => onToggle(o.value)}
      accessibilityHint={i === 0 ? group : undefined}
    />
  ));
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
      ) : null}
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {chips}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{chips}</View>
      )}
    </View>
  );
}
