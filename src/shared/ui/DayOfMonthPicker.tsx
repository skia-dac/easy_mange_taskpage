import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { haptic } from './haptics';
import { Tappable } from './Tappable';
import { useLargeText } from './useLargeText';

type Props = {
  /** Jour choisi (1–31). */
  value: number;
  onChange: (day: number) => void;
  /** Nom du groupe pour le lecteur d'écran (« Ton mois commence le »). */
  accessibilityLabel: string;
  /** Libellé lu pour chaque jour (« Le 25 »). */
  dayLabel: (day: number) => string;
};

/**
 * Choix d'un jour du mois dans une grille compacte (comme un calendrier), au lieu d'une liste de
 * 31 lignes : tout se voit d'un coup d'œil, un seul toucher suffit.
 */
export function DayOfMonthPicker({ value, onChange, accessibilityLabel, dayLabel }: Props) {
  const { colors, spacing } = useTheme();
  const large = useLargeText();
  const columns = large ? 5 : 7;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs }}
    >
      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
        const selected = day === value;
        return (
          <View key={day} style={{ width: `${100 / columns}%`, alignItems: 'center' }}>
            <Tappable
              accessibilityRole="radio"
              accessibilityLabel={dayLabel(day)}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                if (day === value) return;
                haptic('selection');
                onChange(day);
              }}
              borderless
              style={{
                minWidth: minTouchSize,
                minHeight: minTouchSize,
                borderRadius: minTouchSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: spacing.xs,
                backgroundColor: selected ? colors.primary : 'transparent',
              }}
            >
              <AppText
                variant={selected ? 'bodyStrong' : 'body'}
                color={selected ? 'onPrimary' : 'text'}
              >
                {day}
              </AppText>
            </Tappable>
          </View>
        );
      })}
    </View>
  );
}
