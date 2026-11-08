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
  onPress?: () => void;
  /** Titre barré et grisé (élément terminé ou annulé). */
  struck?: boolean;
  /** Libellé lu par le lecteur d'écran à la place de « titre, sous-titre ». */
  accessibilityLabel?: string;
  /** Actions sans geste pour le lecteur d'écran (ex. celles d'un glisser). */
  accessibilityActions?: readonly AccessibilityActionInfo[];
  onAccessibilityAction?: (name: string) => void;
};

/** Ligne de liste : [case] [icône] titre / sous-titre [étiquette] ›. */
export function ListRow({
  title,
  subtitle,
  leading,
  control,
  trailing,
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
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
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
