import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { useRef } from 'react';
import { View, type AccessibilityActionInfo } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { haptic } from './haptics';
import { useTheme, type ColorTokens } from '../theme';
import { AppText } from './AppText';

type Action = {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  onAction: () => void;
};

/**
 * Les actions du glisser, offertes au lecteur d'écran (VoiceOver : balayer vers le haut ou le
 * bas ; TalkBack : menu des actions). À poser sur l'élément focalisable de la ligne.
 */
export type SwipeAccessibility = {
  accessibilityActions: readonly AccessibilityActionInfo[];
  onAccessibilityAction: (name: string) => void;
};

type Props = {
  /**
   * La ligne. Une fonction reçoit les actions pour le lecteur d'écran, à poser sur l'élément
   * focalisable (le bouton de la ligne) ; sinon elles sont posées sur un conteneur.
   */
  children: ReactNode | ((a11y: SwipeAccessibility) => ReactNode);
  /** Glisser vers la droite (ex. terminer). */
  right?: Action;
  /** Glisser vers la gauche (ex. reporter). */
  left?: Action;
  /** Coupe le geste sans démonter la ligne (ex. une tâche déjà terminée). */
  enabled?: boolean;
};

const PRIMARY = 'swipePrimary';
const SECONDARY = 'swipeSecondary';

/** Les actions d'un glisser, sous forme d'actions d'accessibilité (rien si le geste est coupé). */
export function swipeAccessibility(
  right: Action | undefined,
  left: Action | undefined,
  enabled = true,
): SwipeAccessibility {
  const actions: AccessibilityActionInfo[] = [];
  if (enabled && right) actions.push({ name: PRIMARY, label: right.label });
  if (enabled && left) actions.push({ name: SECONDARY, label: left.label });
  return {
    accessibilityActions: actions,
    onAccessibilityAction: (name) => {
      if (!enabled) return;
      if (name === PRIMARY) right?.onAction();
      else if (name === SECONDARY) left?.onAction();
    },
  };
}

/**
 * Ligne qu'on fait glisser : vers la droite pour l'action principale, vers la gauche pour l'autre.
 * La ligne revient en place après l'action. Les mêmes actions restent possibles sans geste :
 * actions d'accessibilité pour VoiceOver et TalkBack, bouton de la ligne, écran de détail.
 */
export function SwipeRow({ children, right, left, enabled = true }: Props) {
  const { colors, spacing, radius } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const a11y = swipeAccessibility(right, left, enabled);

  const panel = (a: Action, align: 'flex-start' | 'flex-end') => (
    <View
      // Décor du geste : le lecteur d'écran passe par les actions, pas par ces panneaux.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flex: 1,
        backgroundColor: colors[a.color],
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: align,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ alignItems: 'center', gap: spacing.xxs }}>
        <Feather name={a.icon} size={22} color={colors.onPrimary} />
        <AppText variant="caption" color="onPrimary">
          {a.label}
        </AppText>
      </View>
    </View>
  );

  const fn = typeof children === 'function';
  return (
    <ReanimatedSwipeable
      ref={ref}
      enabled={enabled}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={right ? () => panel(right, 'flex-start') : undefined}
      renderRightActions={left ? () => panel(left, 'flex-end') : undefined}
      onSwipeableOpen={(direction) => {
        // RIGHT : le contenu est parti vers la droite (panneau de gauche visible).
        const primary = direction === SwipeDirection.RIGHT;
        const action = primary ? right : left;
        // L'action principale (terminer) se sent comme cocher la case ; l'autre, plus légère.
        if (action) haptic(primary ? 'complete' : 'selection');
        ref.current?.close();
        action?.onAction();
      }}
    >
      <View
        style={{ backgroundColor: colors.surface }}
        accessibilityActions={fn ? undefined : a11y.accessibilityActions}
        onAccessibilityAction={
          fn ? undefined : (event) => a11y.onAccessibilityAction(event.nativeEvent.actionName)
        }
      >
        {fn ? children(a11y) : children}
      </View>
    </ReanimatedSwipeable>
  );
}
