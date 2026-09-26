import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

type Option<T> = { value: T; label: string; leading?: ReactNode };

type Props<T> = {
  label?: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  /** Sur une seule ligne qui défile (filtres), sinon sur plusieurs lignes. */
  scroll?: boolean;
};

/** Pastilles à choisir (une ou plusieurs). */
export function ChoiceChips<T>({ label, options, selected, onToggle, scroll }: Props<T>) {
  const { colors, radius, spacing } = useTheme();
  const chips = options.map((o, i) => {
    const on = selected.includes(o.value);
    return (
      <Pressable
        key={i}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => onToggle(o.value)}
        style={{
          minHeight: minTouchSize - 4,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: on ? colors.primary : colors.border,
          backgroundColor: on ? colors.primary : colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {o.leading}
        <AppText variant="bodyStrong" color={on ? 'onPrimary' : 'text'}>
          {o.label}
        </AppText>
      </Pressable>
    );
  });
  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
      ) : null}
      {scroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {chips}
        </ScrollView>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{chips}</View>
      )}
    </View>
  );
}
