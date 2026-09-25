import { View } from 'react-native';

import { useTheme, type ColorTokens } from '@/shared/theme';
import { AppText } from '@/shared/ui';

export type Bar = { label: string; value: number; tone?: keyof ColorTokens };

type Props = {
  bars: Bar[];
  /** Valeur qui remplit toute la hauteur (ex. 20 pour une note). */
  max: number;
  height?: number;
  /** Texte au-dessus de chaque barre (ex. « 14 »). */
  valueLabel?: (value: number) => string;
  accessibilityLabel?: string;
};

/**
 * Histogramme simple dessiné avec des vues (aucune bibliothèque) : identique iPhone / Android,
 * couleurs du thème uniquement.
 */
export function BarChart({ bars, max, height = 120, valueLabel, accessibilityLabel }: Props) {
  const { colors, radius, spacing } = useTheme();
  const safeMax = max > 0 ? max : 1;
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: height + 40 }}
    >
      {bars.map((b, i) => {
        const h = Math.max(4, Math.round((Math.min(b.value, safeMax) / safeMax) * height));
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {valueLabel ? (
              <AppText variant="caption" color="muted">
                {valueLabel(b.value)}
              </AppText>
            ) : null}
            <View
              style={{
                width: '70%',
                height: h,
                borderRadius: radius.sm,
                backgroundColor: colors[b.tone ?? 'primary'],
              }}
            />
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {b.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
