import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

/** Bouton rond « + » en bas à droite (ajout rapide, §12). */
export function Fab({
  onPress,
  accessibilityLabel,
}: {
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: spacing.xl, bottom: spacing.xl }}
    >
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={{
          width: 58,
          height: 58,
          borderRadius: radius.lg,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: colors.text,
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <Feather name="plus" size={28} color={colors.onPrimary} />
      </PressableScale>
    </View>
  );
}
