import { Pressable } from 'react-native';

import { minTouchSize, type ColorTokens } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  disabled?: boolean;
  /** Pour un libellé purement visuel (« ‹ »), ce que le lecteur d'écran annonce. */
  accessibilityLabel?: string;
};

/** Bouton texte (actions secondaires, « Supprimer »…). */
export function TextButton({
  label,
  onPress,
  color = 'primary',
  disabled = false,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
