import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  /** Ce que la section contient, sous le libellé quand elle est fermée. */
  hint?: string;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
};

/** Section repliable d'un formulaire (« Plus d'options ») : les champs rares restent à un geste. */
export function Disclosure({ label, hint, open, onToggle, children }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={open ? undefined : hint}
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(!open)}
        style={({ pressed }) => ({
          minHeight: minTouchSize,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" color="primary">
            {label}
          </AppText>
          {!open && hint ? (
            <AppText variant="caption" color="muted">
              {hint}
            </AppText>
          ) : null}
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
      </Pressable>
      {open ? children : null}
    </>
  );
}
