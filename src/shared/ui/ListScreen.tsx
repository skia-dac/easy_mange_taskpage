import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View, type ListRenderItem, type ViewStyle } from 'react-native';
import Animated, { LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarInset, useTabBarScrollHandlers } from '../tabBarVisibility';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { RiseIn, staggerDelay } from './RiseIn';

/**
 * Lignes animées à l'arrivée : à peu près un écran. Au-delà, une ligne qui apparaît en défilant
 * s'affiche tout de suite, sans entrée ni glissement (rien ne rame sur un téléphone moyen).
 */
export const ANIMATED_ROWS = 12;

/** Position d'une ligne dans sa carte : les lignes d'une même carte sont collées. */
export type CardPosition = 'only' | 'first' | 'middle' | 'last';

export function cardPosition(index: number, count: number): CardPosition {
  if (count <= 1) return 'only';
  if (index === 0) return 'first';
  return index === count - 1 ? 'last' : 'middle';
}

/**
 * Un morceau de carte : le même fond, bord et arrondi que `Card`, découpé ligne par ligne pour
 * qu'une liste virtualisée garde l'aspect d'une carte sans tout afficher d'un coup.
 */
export function CardSegment({
  position,
  children,
}: {
  position: CardPosition;
  children: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  const top = position === 'only' || position === 'first';
  const bottom = position === 'only' || position === 'last';
  const style: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopWidth: top ? 1 : 0,
    borderBottomWidth: bottom ? 1 : 0,
    borderTopLeftRadius: top ? radius.lg : 0,
    borderTopRightRadius: top ? radius.lg : 0,
    borderBottomLeftRadius: bottom ? radius.lg : 0,
    borderBottomRightRadius: bottom ? radius.lg : 0,
    paddingHorizontal: spacing.lg,
    paddingTop: top ? spacing.lg : 0,
    paddingBottom: bottom ? spacing.lg : 0,
  };
  return <View style={style}>{children}</View>;
}

/**
 * Glissement des lignes quand une ligne part ou arrive (tâche terminée, supprimée). Dans une
 * liste virtualisée, chaque ligne vit dans sa propre cellule : seule une animation posée sur la
 * cellule elle-même (`itemLayoutAnimation`) la déplace ; une animation à l'intérieur ne bouge pas
 * la cellule, et les lignes sauteraient.
 */
export const listItemLayout = LinearTransition.duration(200);

/**
 * Une ligne de liste virtualisée : elle entre en douceur dans le premier écran seulement,
 * affichée telle quelle au-delà. Le glissement des suivantes est porté par la liste
 * (`listItemLayout`), pas par la ligne.
 */
export function ListItemMotion({
  index,
  children,
}: {
  index: number;
  /** Conservé pour les appels existants : le glissement est porté par la cellule. */
  row?: boolean;
  children: ReactNode;
}) {
  if (index >= ANIMATED_ROWS) return <>{children}</>;
  return <RiseIn delay={staggerDelay(index + 1)}>{children}</RiseIn>;
}

type Props<T> = {
  title: string;
  subtitle?: string;
  /** Boutons à droite du titre (ex. recherche). */
  actions?: ReactNode;
  /** Contenu fixe sous le titre (sélecteur, filtres), qui défile avec la liste. */
  header?: ReactNode;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  /** Affiché à la place des lignes quand il n'y en a aucune (vide, chargement, erreur). */
  empty?: ReactElement | null;
  /** Sous la dernière ligne, avant la place laissée au bouton +. */
  footer?: ReactNode;
  /** Place en bas (ex. `FAB_CLEARANCE` sous le bouton +). */
  bottomSpace?: number;
  onEndReached?: () => void;
};

/**
 * Comme `Screen` (titre, défilement qui cache la barre d'onglets), mais la liste est virtualisée :
 * seules les lignes proches de l'écran sont montées. Pour les listes qui peuvent devenir longues.
 */
export function ListScreen<T>({
  title,
  subtitle,
  actions,
  header,
  data,
  renderItem,
  keyExtractor,
  empty,
  footer,
  bottomSpace = 0,
  onEndReached,
}: Props<T>) {
  const { colors, spacing } = useTheme();
  const scroll = useTabBarScrollHandlers();
  const tabBarInset = useTabBarInset();
  const reduced = useReducedMotion();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <Animated.FlatList
        {...scroll}
        // Animations coupées : les lignes prennent leur place sans glisser.
        itemLayoutAnimation={reduced ? undefined : listItemLayout}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialNumToRender={ANIMATED_ROWS}
        maxToRenderPerBatch={10}
        windowSize={9}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xl + tabBarInset,
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg }}>
            <RiseIn>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  {subtitle ? (
                    <AppText variant="caption" color="muted">
                      {subtitle}
                    </AppText>
                  ) : null}
                  <AppText variant="title" accessibilityRole="header">
                    {title}
                  </AppText>
                </View>
                {actions ? (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>{actions}</View>
                ) : null}
              </View>
            </RiseIn>
            {header ? (
              <RiseIn delay={staggerDelay(1)} style={{ gap: spacing.lg }}>
                {header}
              </RiseIn>
            ) : null}
          </View>
        }
        ListEmptyComponent={empty ? <View style={{ marginTop: spacing.lg }}>{empty}</View> : null}
        ListFooterComponent={
          <View>
            {footer ? <View style={{ marginTop: spacing.lg }}>{footer}</View> : null}
            <View style={{ height: bottomSpace }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
