import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Button } from './Button';
import { KeyboardAvoiding } from './KeyboardAvoiding';

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
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoiding>
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
    </KeyboardAvoiding>
  );
}
