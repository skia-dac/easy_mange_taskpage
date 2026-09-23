import { Pressable } from 'react-native';

import { minTouchSize, type ColorTokens } from '../theme';
import { AppText } from './AppText';

type Props = { label: string; onPress: () => void; color?: keyof ColorTokens };

/** Bouton texte (actions secondaires, « Supprimer »…). */
export function TextButton({ label, onPress, color = 'primary' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <AppText variant="bodyStrong" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}
