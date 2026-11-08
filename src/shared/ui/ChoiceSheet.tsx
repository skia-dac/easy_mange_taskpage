import Feather from '@expo/vector-icons/Feather';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Tappable } from './Tappable';

export type ChoiceOption = {
  label: string;
  hint?: string;
  onPress: () => void;
  destructive?: boolean;
  /** Option actuellement choisie : coche visible et état « sélectionné » pour le lecteur d'écran. */
  selected?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  options: ChoiceOption[];
  onClose: () => void;
};

/**
 * Menu de choix en bas de l'écran, identique sur iPhone et Android
 * (la boîte native limite Android à 3 boutons et change l'ordre).
 */
export function ChoiceSheet({ visible, title, message, options, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {message ? <AppText color="muted">{message}</AppText> : null}
      <ScrollView
        style={{ maxHeight: height * 0.6, marginTop: spacing.xs }}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        {options.map((o, i) => (
          <Tappable
            key={`${i}:${o.label}`}
            accessibilityRole="button"
            accessibilityState={o.selected ? { selected: true } : undefined}
            onPress={() => {
              onClose();
              o.onPress();
            }}
            style={() => ({
              minHeight: minTouchSize + 8,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: o.destructive
                ? colors.dangerSoft
                : o.selected
                  ? colors.primarySoft
                  : colors.background,
            })}
          >
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <AppText variant="bodyStrong" color={o.destructive ? 'danger' : 'text'}>
                {o.label}
              </AppText>
              {o.hint ? (
                <AppText variant="caption" color="muted">
                  {o.hint}
                </AppText>
              ) : null}
            </View>
            {o.selected ? <Feather name="check" size={20} color={colors.primary} /> : null}
          </Tappable>
        ))}
      </ScrollView>
      <View style={{ marginTop: spacing.xs }}>
        <Tappable
          accessibilityRole="button"
          onPress={onClose}
          style={{ minHeight: minTouchSize, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppText variant="bodyStrong" color="primary">
            {t('common.cancel')}
          </AppText>
        </Tappable>
      </View>
    </BottomSheet>
  );
}
