import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

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
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={t('common.cancel')}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xl + insets.bottom,
            gap: spacing.sm,
          }}
        >
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          {message ? <AppText color="muted">{message}</AppText> : null}
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {options.map((o) => (
              <Pressable
                key={o.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  o.onPress();
                }}
                style={({ pressed }) => ({
                  minHeight: minTouchSize + 8,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  justifyContent: 'center',
                  backgroundColor: o.destructive ? colors.dangerSoft : colors.background,
                  opacity: pressed ? 0.8 : 1,
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
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{ minHeight: minTouchSize, alignItems: 'center', justifyContent: 'center' }}
            >
              <AppText variant="bodyStrong" color="primary">
                {t('common.cancel')}
              </AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
