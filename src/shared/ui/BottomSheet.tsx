import { useEffect, useRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '../theme';

type Props = {
  visible: boolean;
  /** Fermer sans rien choisir : voile touché, bouton retour Android, geste « Z » de VoiceOver. */
  onClose: () => void;
  /**
   * La fenêtre a fini de disparaître (iOS : la fenêtre native est retirée ; Android : dès
   * qu'elle est masquée). C'est le bon moment pour en ouvrir une autre : iOS refuse deux
   * fenêtres l'une sur l'autre.
   */
  onDismissed?: () => void;
  children: ReactNode;
  /** La fenêtre contient un champ de saisie : elle remonte au-dessus du clavier. */
  avoidKeyboard?: boolean;
  /**
   * Retouches du contenu (marges intérieures, écart entre les blocs). La marge du bas s'ajoute
   * toujours à celle de la barre d'accueil de l'iPhone : elle ne peut pas la remplacer.
   */
  style?: StyleProp<ViewStyle>;
};

/** Part de la hauteur utile (fenêtre moins les zones système) que le panneau peut occuper. */
export const SHEET_MAX_RATIO = 0.85;
/** Glisser vers le bas au-delà de cette distance (ou assez vite) ferme la fenêtre. */
const CLOSE_DISTANCE = 96;
const CLOSE_VELOCITY = 900;
const ENTER_MS = 260;

/** Hauteur maximale du panneau : ≈ 85 % de la fenêtre, zones système (encoche, barre) exclues. */
export function sheetMaxHeight(windowHeight: number, insets: Pick<EdgeInsets, 'top' | 'bottom'>) {
  return Math.round((windowHeight - insets.top - insets.bottom) * SHEET_MAX_RATIO);
}

/**
 * Marges du contenu : celles par défaut, puis les retouches de l'écran, puis la marge du bas
 * augmentée de la barre d'accueil (jamais écrasée par une retouche).
 */
export function sheetContentStyle(
  base: { padding: number; gap: number },
  style: StyleProp<ViewStyle>,
  bottomInset: number,
): ViewStyle {
  const merged: ViewStyle = StyleSheet.flatten<ViewStyle>([base, style]);
  const bottom = merged.paddingBottom ?? merged.paddingVertical ?? merged.padding ?? base.padding;
  return { ...merged, paddingBottom: (typeof bottom === 'number' ? bottom : 0) + bottomInset };
}

/**
 * Fenêtre posée en bas de l'écran, sur un voile. Elle monte du bas (un simple fondu quand les
 * animations sont réduites), porte une poignée et se ferme en la glissant vers le bas. Son contenu
 * défile s'il dépasse ≈ 85 % de l'écran (texte agrandi, clavier ouvert).
 *
 * Le voile et le panneau sont FRÈRES, jamais l'un dans l'autre : un bouton qui contient tout le
 * panneau en ferait un seul élément pour VoiceOver, et ses choix deviendraient inatteignables.
 * Le voile et la poignée sont invisibles pour le lecteur d'écran (on ferme avec « Annuler », le
 * bouton retour d'Android ou le geste d'échappement de VoiceOver) ; le panneau est modal pour lui.
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  children,
  avoidKeyboard,
  style,
}: Props) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const maxHeight = sheetMaxHeight(height, insets);

  // Le panneau part du bas de l'écran et monte à sa place à chaque ouverture.
  const offset = useSharedValue(reduced ? 0 : height);
  useEffect(() => {
    if (!visible) {
      // Fermeture : le panneau redescend pendant que le voile s'efface (et il est prêt pour
      // la prochaine ouverture).
      if (!reduced) offset.set(withTiming(height, { duration: 200 }));
      return;
    }
    if (reduced) {
      offset.set(0);
      return;
    }
    offset.set(height);
    offset.set(withTiming(0, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) }));
  }, [visible, reduced, height, offset]);

  // Android ne signale pas la fin de la fermeture : la fenêtre y disparaît dès qu'elle est masquée.
  const wasVisible = useRef(visible);
  useEffect(() => {
    const was = wasVisible.current;
    wasVisible.current = visible;
    if (Platform.OS !== 'ios' && was && !visible) onDismissed?.();
  }, [visible, onDismissed]);

  const close = () => onClose();
  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      'worklet';
      offset.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY) {
        if (reduced) {
          scheduleOnRN(close);
          return;
        }
        offset.set(
          withTiming(height, { duration: 180 }, (finished) => {
            if (finished) scheduleOnRN(close);
          }),
        );
      } else {
        offset.set(reduced ? 0 : withSpring(0, { damping: 20, stiffness: 220 }));
      }
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));

  const body = (
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + spacing.lg }}>
      <Pressable
        testID="sheet-backdrop"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
      />
      <Animated.View
        testID="sheet-panel"
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        style={[
          {
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            maxHeight,
            // Clavier ouvert : le panneau rétrécit (et son contenu défile) au lieu de déborder.
            flexShrink: 1,
          },
          slide,
        ]}
      >
        <GestureDetector gesture={drag}>
          <View
            testID="sheet-handle"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ alignItems: 'center', paddingVertical: spacing.md }}
          >
            <View
              style={{
                width: 36,
                height: 5,
                borderRadius: radius.pill,
                backgroundColor: colors.border,
              }}
            />
          </View>
        </GestureDetector>
        <ScrollView
          testID="sheet-scroll"
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={sheetContentStyle(
            { padding: spacing.xl, gap: spacing.sm },
            [{ paddingTop: spacing.xs }, style],
            insets.bottom,
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
  return (
    // `onRequestClose` : le bouton retour d'Android ferme la fenêtre. Le voile apparaît en fondu,
    // le panneau monte par-dessus (voir `offset`).
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismissed}
    >
      {/* Android : les gestes d'une fenêtre ont besoin de leur propre racine. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
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
      </GestureHandlerRootView>
    </Modal>
  );
}
