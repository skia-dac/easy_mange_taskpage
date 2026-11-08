import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  /** Fermer sans rien choisir : voile touché, bouton retour Android, geste « Z » de VoiceOver. */
  onClose: () => void;
  children: ReactNode;
  /** La fenêtre contient un champ de saisie : elle remonte au-dessus du clavier. */
  avoidKeyboard?: boolean;
  /** Retouches du panneau (marges intérieures, écart entre les blocs). */
  style?: StyleProp<ViewStyle>;
  /** iPhone : la fenêtre a fini de disparaître (`onDismiss` de Modal, iOS seulement). */
  onDismissed?: () => void;
};

/**
 * Fenêtre posée en bas de l'écran, sur un voile.
 *
 * Le voile et le panneau sont FRÈRES, jamais l'un dans l'autre : un bouton qui contient tout le
 * panneau en ferait un seul élément pour VoiceOver, et ses choix deviendraient inatteignables.
 * Le voile est invisible pour le lecteur d'écran (on ferme avec « Annuler », le bouton retour
 * d'Android ou le geste d'échappement de VoiceOver) ; le panneau est modal pour lui.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  avoidKeyboard,
  style,
  onDismissed,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const body = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable
        testID="sheet-backdrop"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
      />
      <View
        testID="sheet-panel"
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        style={[
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xl + insets.bottom,
            gap: spacing.sm,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
  return (
    // `onRequestClose` : le bouton retour d'Android ferme la fenêtre.
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}
