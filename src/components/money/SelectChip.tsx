import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';

import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Tappable } from '@/shared/ui';
import { haptic } from '@/shared/ui/haptics';

type Props = {
  label: string;
  /** Choisie : fond doux, contour et coche de la couleur principale. */
  selected?: boolean;
  onPress: () => void;
  leading?: ReactNode;
  /** `radio` dans un groupe de choix (catégorie, date) ; `button` pour une action (« Tout voir »). */
  role?: 'radio' | 'button';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** Déjà choisie, elle réagit encore (« Choisir… » rouvre le calendrier). */
  reselectable?: boolean;
};

/**
 * Pastille de la saisie d'une opération : icône + libellé complet (jamais coupé : la pastille
 * s'élargit, et passe à la ligne avec un très grand texte). Au moins 44 pt de haut.
 */
export function SelectChip({
  label,
  selected = false,
  onPress,
  leading,
  role = 'radio',
  accessibilityLabel,
  accessibilityHint,
  testID,
  reselectable = false,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Tappable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={role === 'radio' ? { checked: selected } : undefined}
      onPress={() => {
        if (role === 'radio' && selected && !reselectable) return;
        haptic('selection');
        onPress();
      }}
      style={{
        alignSelf: 'flex-start',
        minHeight: minTouchSize,
        paddingLeft: leading ? spacing.xs : spacing.md,
        paddingRight: spacing.md,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        borderWidth: 1.5,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      }}
    >
      {leading}
      <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
        {label}
      </AppText>
      {selected ? <Feather name="check" size={16} color={colors.primary} /> : null}
    </Tappable>
  );
}
