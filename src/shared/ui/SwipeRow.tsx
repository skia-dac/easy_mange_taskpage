import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps, ReactNode } from 'react';
import { useRef } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme, type ColorTokens } from '../theme';
import { AppText } from './AppText';

type Action = {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  onAction: () => void;
};

type Props = {
  children: ReactNode;
  /** Glisser vers la droite (ex. terminer). */
  right?: Action;
  /** Glisser vers la gauche (ex. reporter). */
  left?: Action;
  /** Coupe le geste sans démonter la ligne (ex. une tâche déjà terminée). */
  enabled?: boolean;
};

/**
 * Ligne qu'on fait glisser : vers la droite pour l'action principale, vers la gauche pour l'autre.
 * La ligne revient en place après l'action. Les mêmes actions restent possibles sans geste
 * (bouton de la ligne, écran de détail) pour l'accessibilité.
 */
export function SwipeRow({ children, right, left, enabled = true }: Props) {
  const { colors, spacing, radius } = useTheme();
  const ref = useRef<SwipeableMethods>(null);

  const panel = (a: Action, align: 'flex-start' | 'flex-end') => (
    <View
      style={{
        flex: 1,
        backgroundColor: colors[a.color],
        borderRadius: radius.md,
        justifyContent: 'center',
        alignItems: align,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Feather name={a.icon} size={22} color={colors.onPrimary} />
        <AppText variant="caption" color="onPrimary">
          {a.label}
        </AppText>
      </View>
    </View>
  );

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
        const action = direction === SwipeDirection.RIGHT ? right : left;
        ref.current?.close();
        action?.onAction();
      }}
    >
      <View style={{ backgroundColor: colors.surface }}>{children}</View>
    </ReanimatedSwipeable>
  );
}
