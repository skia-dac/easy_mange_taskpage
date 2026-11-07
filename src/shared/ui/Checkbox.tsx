import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { haptic } from './haptics';
import { CheckPop } from './checkMotion';
import { Tappable } from './Tappable';

type Props = { checked: boolean; onToggle: () => void; accessibilityLabel: string };

/** Case à cocher ronde, zone touchable de 44 pt. */
export function Checkbox({ checked, onToggle, accessibilityLabel }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <Tappable
      borderless
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        // Cocher (terminer) se sent sous le doigt ; décocher reste discret.
        if (!checked) haptic('complete');
        onToggle();
      }}
      style={{
        width: minTouchSize,
        height: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -spacing.sm,
      }}
    >
      <CheckPop checked={checked}>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: checked ? colors.success : colors.muted,
            backgroundColor: checked ? colors.success : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Feather name="check" size={16} color={colors.surface} /> : null}
        </View>
      </CheckPop>
    </Tappable>
  );
}
