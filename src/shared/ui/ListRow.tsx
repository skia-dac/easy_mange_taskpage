import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { View, type AccessibilityActionInfo } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { useLargeText } from './useLargeText';

type Props = {
  title: string;
  subtitle?: string | null;
  /** Décor à gauche (icône, heure) : il fait partie de la zone touchable de la ligne. */
  leading?: ReactNode;
  /**
   * Commande à gauche (case à cocher). Elle est posée À CÔTÉ de la zone touchable, jamais
   * dedans : VoiceOver regroupe un bouton et tout son contenu en un seul élément, la case
   * serait inatteignable. Ici le lecteur d'écran trouve deux éléments : la case, puis la ligne.
   */
  control?: ReactNode;
  trailing?: ReactNode;
  /**
   * Ce que dit l'étiquette de droite (« En retard », « Dans 3 jours »…). La ligne est un seul
   * bouton pour le lecteur d'écran : sans ce texte, l'étiquette ne serait jamais annoncée.
   */
  trailingLabel?: string | null;
  onPress?: () => void;
  /** Titre barré et grisé (élément terminé ou annulé). */
  struck?: boolean;
  /** Libellé lu par le lecteur d'écran à la place de « titre, sous-titre ». */
  accessibilityLabel?: string;
  /** Actions sans geste pour le lecteur d'écran (ex. celles d'un glisser). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (name: string) => void;
};

/**
 * Libellé lu par le lecteur d'écran : « titre, sous-titre, étiquette ». Un libellé imposé
 * remplace le titre et le sous-titre, mais l'étiquette (état, compte à rebours) reste annoncée.
 */
export function rowAccessibilityLabel({
  title,
  subtitle,
  trailingLabel,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string | null;
  trailingLabel?: string | null;
  accessibilityLabel?: string;
}): string {
  const main = accessibilityLabel ? [accessibilityLabel] : [title, subtitle];
  return [...main, trailingLabel].filter(Boolean).join(', ');
}

/** Ligne de liste : [case] [icône] titre / sous-titre [étiquette] ›. */
export function ListRow({
  title,
  subtitle,
  leading,
  control,
  trailing,
  trailingLabel,
  onPress,
  struck,
  accessibilityLabel,
  accessibilityActions,
  onAccessibilityAction,
}: Props) {
  const { colors, spacing } = useTheme();
  // Très grand texte : rien n'est coupé, et l'étiquette de droite passe sous le titre.
  const large = useLargeText();
  const lines = large ? undefined : 2;
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        minHeight: minTouchSize + 8,
        paddingVertical: spacing.sm,
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText
          variant="bodyStrong"
          color={struck ? 'muted' : 'text'}
          style={struck ? { textDecorationLine: 'line-through' } : undefined}
          numberOfLines={lines}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={lines}>
            {subtitle}
          </AppText>
        ) : null}
        {large && trailing ? (
          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>{trailing}</View>
        ) : null}
      </View>
      {large ? null : trailing}
      {onPress ? <Feather name="chevron-right" size={18} color={colors.muted} /> : null}
    </View>
  );
  const body = onPress ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={rowAccessibilityLabel({
        title,
        subtitle,
        trailingLabel,
        accessibilityLabel,
      })}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={
        onAccessibilityAction
          ? (event) => onAccessibilityAction(event.nativeEvent.actionName)
          : undefined
      }
      onPress={onPress}
    >
      {content}
    </PressableScale>
  ) : (
    content
  );
  if (!control) return body;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {control}
      <View style={{ flex: 1 }}>{body}</View>
    </View>
  );
}
