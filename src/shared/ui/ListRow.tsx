import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { useLargeText } from './useLargeText';

type Props = {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Titre barré et grisé (élément terminé ou annulé). */
  struck?: boolean;
};

/** Ligne de liste : [icône] titre / sous-titre [étiquette] ›. */
export function ListRow({ title, subtitle, leading, trailing, onPress, struck }: Props) {
  const { colors, spacing } = useTheme();
  // Très grand texte : rien n'est coupé, et l'étiquette de droite passe sous le titre.
  const large = useLargeText();
  const lines = large ? undefined : 2;
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: minTouchSize + 8,
        paddingVertical: spacing.sm,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText
          variant="bodyStrong"
          color={struck ? 'muted' : 'text'}
          style={struck ? { textDecorationLine: 'line-through' } : undefined}
          numberOfLines={lines}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={lines}>
            {subtitle}
          </AppText>
        ) : null}
        {large && trailing ? (
          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>{trailing}</View>
        ) : null}
      </View>
      {large ? null : trailing}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle].filter(Boolean).join(', ')}
      onPress={onPress}
    >
      {content}
    </PressableScale>
  );
}
