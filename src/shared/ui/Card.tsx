import type { ReactNode } from 'react';
import {
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Rôle annoncé par le lecteur d'écran (par défaut « bouton ») et son état (coché…). */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  style?: StyleProp<ViewStyle>;
};

/** Carte blanche arrondie. Si `onPress` est donné, elle devient un bouton. */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  style,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      style={[base, style]}
    >
      {children}
    </PressableScale>
  );
}
