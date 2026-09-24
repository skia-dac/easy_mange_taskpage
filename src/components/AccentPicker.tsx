import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { accentColors, accentIds, minTouchSize, useTheme, type AccentId } from '@/shared/theme';
import { AppText } from '@/shared/ui';

/** Couleur principale de l'app (boutons, onglet actif, carte du prochain cours…). */
export function AccentPicker({
  value,
  onChange,
}: {
  value: AccentId;
  onChange: (v: AccentId) => void;
}) {
  const { t } = useTranslation();
  const { scheme, spacing, colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="bodyStrong">{t('settings.accent')}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {accentIds.map((id) => {
          const c = accentColors[id][scheme];
          const selected = id === value;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`settings.accents.${id}`)}
              onPress={() => onChange(id)}
              style={{
                width: minTouchSize,
                height: minTouchSize,
                borderRadius: minTouchSize / 2,
                backgroundColor: c.primary,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 3 : 0,
                borderColor: colors.text,
              }}
            >
              {selected ? <Feather name="check" size={20} color={c.onPrimary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
