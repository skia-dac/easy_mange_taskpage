import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { useTheme } from '../theme';

/** Décale le contenu au-dessus du clavier (mécanisme différent selon la plateforme, rendu identique). */
export function KeyboardAvoiding({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
