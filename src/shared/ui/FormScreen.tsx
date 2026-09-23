import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  saving?: boolean;
  /** Contenu sous le bouton (ex. « Supprimer »). */
  footer?: ReactNode;
};

/** Formulaire : champs qui défilent au-dessus du clavier, gros bouton « Enregistrer » en bas. */
export function FormScreen({ children, submitLabel, onSubmit, saving, footer }: Props) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: spacing.xxl + insets.bottom,
        }}
      >
        {children}
        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <Button label={submitLabel} onPress={onSubmit} disabled={saving} />
          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
