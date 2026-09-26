import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

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
      <View style={{ flex: 1, gap: 2 }}>
        <AppText
          variant="bodyStrong"
          color={struck ? 'muted' : 'text'}
          style={struck ? { textDecorationLine: 'line-through' } : undefined}
          numberOfLines={2}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
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
