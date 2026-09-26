import { Pressable } from 'react-native';

import { minTouchSize, type ColorTokens } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  disabled?: boolean;
};

/** Bouton texte (actions secondaires, « Supprimer »…). */
export function TextButton({ label, onPress, color = 'primary', disabled = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <AppText variant="bodyStrong" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}
