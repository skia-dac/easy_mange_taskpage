import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { Tappable } from './Tappable';

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
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={open ? undefined : hint}
        accessibilityState={{ expanded: open }}
        onPress={() => onToggle(!open)}
        style={() => ({
          minHeight: minTouchSize,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        })}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
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
      </Tappable>
      {open ? children : null}
    </>
  );
}
