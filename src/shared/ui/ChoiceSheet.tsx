import { View } from 'react-native';
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
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {message ? <AppText color="muted">{message}</AppText> : null}
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {options.map((o) => (
          <Tappable
            key={o.label}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              o.onPress();
            }}
            style={() => ({
              minHeight: minTouchSize + 8,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              justifyContent: 'center',
              backgroundColor: o.destructive ? colors.dangerSoft : colors.background,
            })}
          >
            <AppText variant="bodyStrong" color={o.destructive ? 'danger' : 'text'}>
              {o.label}
            </AppText>
            {o.hint ? (
              <AppText variant="caption" color="muted">
                {o.hint}
              </AppText>
            ) : null}
          </Tappable>
        ))}
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
