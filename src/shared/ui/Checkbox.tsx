import Feather from '@expo/vector-icons/Feather';
import { Pressable, View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { CheckPop } from './checkMotion';

type Props = { checked: boolean; onToggle: () => void; accessibilityLabel: string };

/** Case à cocher ronde, zone touchable de 44 pt. */
export function Checkbox({ checked, onToggle, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      onPress={onToggle}
      style={{
        width: minTouchSize,
        height: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -8,
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
    </Pressable>
  );
}
