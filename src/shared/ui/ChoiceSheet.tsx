import Feather from '@expo/vector-icons/Feather';
import { useCallback, useRef } from 'react';
import { Platform, ScrollView, useWindowDimensions, View } from 'react-native';
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

/** Android : pas d'`onDismiss`, on attend la fin du fondu de fermeture. */
export const CHOICE_ANDROID_DELAY_MS = 300;
/** iPhone : filet de sécurité si `onDismiss` n'arrive pas (fenêtre démontée avant la fin). */
export const CHOICE_IOS_FALLBACK_MS = 1000;

/**
 * Menu de choix en bas de l'écran, identique sur iPhone et Android
 * (la boîte native limite Android à 3 boutons et change l'ordre).
 *
 * L'action choisie ne part qu'une fois la fenêtre fermée : sur iPhone, une alerte présentée
 * pendant qu'une Modal disparaît peut être ignorée par le système (la confirmation qui suit
 * ne s'afficherait jamais et l'écran resterait bloqué).
 */
export function ChoiceSheet({ visible, title, message, options, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { height } = useWindowDimensions();
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Lance l'action en attente, une seule fois (fin de fermeture ou filet de sécurité). */
  const runPending = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const choose = (o: ChoiceOption) => {
    // Un second appui pendant la fermeture ne lance pas une seconde action.
    if (pending.current) return;
    pending.current = o.onPress;
    onClose();
    timer.current = setTimeout(
      runPending,
      Platform.OS === 'ios' ? CHOICE_IOS_FALLBACK_MS : CHOICE_ANDROID_DELAY_MS,
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={Platform.OS === 'ios' ? runPending : undefined}
    >
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
            onPress={() => choose(o)}
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
