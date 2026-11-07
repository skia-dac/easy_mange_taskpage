import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { haptic } from '../haptics';
import { AppText } from './AppText';
import { useLineLimit } from './useLargeText';
import { Tappable } from './Tappable';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Ce que le choix règle (« Vue du carnet », « Affichage »…) : annoncé par le lecteur d'écran. */
  accessibilityLabel: string;
};

/** Marge entre le rail et le segment choisi (comme le contrôle segmenté d'iOS). */
const SEGMENT_INSET = 3;

/** Choix exclusif sur une ligne (ex. Jour / Semaine / Mois). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const { colors, radius, spacing } = useTheme();
  const lines = useLineLimit(1);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        backgroundColor: colors.border,
        borderRadius: radius.md,
        padding: SEGMENT_INSET,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Tappable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(o.value);
            }}
            style={{
              flex: 1,
              minHeight: minTouchSize,
              borderRadius: radius.md - SEGMENT_INSET,
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.xs,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <AppText
              variant="bodyStrong"
              color={selected ? 'text' : 'muted'}
              numberOfLines={lines}
              style={{ textAlign: 'center' }}
            >
              {o.label}
            </AppText>
          </Tappable>
        );
      })}
    </View>
  );
}
