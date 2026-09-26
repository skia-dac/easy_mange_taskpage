import { HeaderHeightContext } from '@react-navigation/elements';
import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { useTheme } from '../theme';

/**
 * Décale le contenu au-dessus du clavier (mécanisme différent selon la plateforme, rendu identique).
 * Le décalage vertical vaut la hauteur de l'en-tête de navigation (0 hors d'un navigateur).
 */
export function KeyboardAvoiding({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  // `useHeaderHeight()` lève une erreur hors navigateur : on lit le contexte avec un repli à 0.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
