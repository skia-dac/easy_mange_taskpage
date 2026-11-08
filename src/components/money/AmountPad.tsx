import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { View, type AccessibilityActionEvent } from 'react-native';

import { useTheme } from '@/shared/theme';
import { AppText, Tappable, useTextScale } from '@/shared/ui';
import { haptic } from '@/shared/ui/haptics';

import { padKeyGap, padKeyHeight, type AmountPadMode } from './amountPadLayout';

/** Une touche : un chiffre, « 000 », « , » ou l'effacement (`back`). */
export type PadKey = string;

type Props = {
  /** Décimales de la monnaie : « , » remplace « 000 » seulement si elle en a (pas le FCFA). */
  decimals: number;
  mode: AmountPadMode;
  onKey: (key: PadKey) => void;
  /** Touche longue sur ⌫ : tout effacer. */
  onClear: () => void;
};

/**
 * Pavé numérique 4 × 3, compact (≈ 54 pt par touche) : 1-9, puis « 000 » (ou « , »), 0 et ⌫.
 * ⌫ est en bas à droite, sous le pouce ; en bas à gauche (où flotte le bouton des outils
 * d'Expo Go en développement) il n'y a que « 000 ». Chaque touche donne un léger retour tactile
 * et s'assombrit sous le doigt ; une touche longue sur ⌫ efface tout.
 */
export function AmountPad({ decimals, mode, onKey, onClear }: Props) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const scale = useTextScale();
  const height = padKeyHeight(mode, scale);
  const gap = padKeyGap(mode);
  const extra = decimals > 0 ? ',' : '000';
  const rows: PadKey[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [extra, '0', 'back'],
  ];
  const labelOf = (k: PadKey) =>
    k === 'back'
      ? t('money.erase')
      : k === '000'
        ? t('money.threeZeros')
        : k === ','
          ? t('money.decimalComma')
          : k;
  const clear = () => {
    haptic('selection');
    onClear();
  };
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'clear') clear();
  };

  return (
    <View style={{ gap }}>
      {rows.map((row) => (
        <View key={row.join()} style={{ flexDirection: 'row', gap }}>
          {row.map((k) => {
            const back = k === 'back';
            return (
              <Tappable
                key={k}
                testID={`pad-${k}`}
                accessibilityRole="button"
                accessibilityLabel={labelOf(k)}
                accessibilityHint={back ? t('money.eraseHint') : undefined}
                accessibilityActions={
                  back ? [{ name: 'clear', label: t('money.clearAll') }] : undefined
                }
                onAccessibilityAction={back ? onAction : undefined}
                onPress={() => {
                  haptic('selection');
                  onKey(k);
                }}
                onLongPress={back ? clear : undefined}
                delayLongPress={450}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: height,
                  borderRadius: radius.md,
                  // Retour visible sous le doigt, en plus de l'éclaircissement (iOS) ou de l'onde
                  // (Android) de `Tappable`.
                  backgroundColor: pressed
                    ? colors.primarySoft
                    : back
                      ? 'transparent'
                      : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                })}
              >
                {back ? (
                  <Feather name="delete" size={24} color={colors.text} />
                ) : (
                  <AppText variant="headline">{k}</AppText>
                )}
              </Tappable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
