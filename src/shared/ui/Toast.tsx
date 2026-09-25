import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { userMessageKey } from '../errors';
import { i18n } from '../i18n';
import { logger } from '../logger';
import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { showError } from './dialogs';

export type ToastAction = { label: string; onPress: () => void };
type Entry = { id: number; message: string; action?: ToastAction };

/** Durée d'affichage : plus longue quand il y a un bouton (le temps de le lire et d'appuyer). */
const SHOW_MS = 3500;
const SHOW_WITH_ACTION_MS = 6000;
/** Hauteur de la barre d'onglets, pour afficher le message au-dessus. */
const TAB_BAR_HEIGHT = 64;

let listener: ((entry: Entry) => void) | null = null;
let seq = 0;

/**
 * Message discret en bas de l'écran (« Terminé », « Reporté à demain »…), non bloquant, avec
 * au plus un bouton. Sans `ToastHost` monté (tests), il ne fait rien.
 */
export function showToast(message: string, action?: ToastAction): void {
  listener?.({ id: ++seq, message, action });
}

/** Message + « Annuler » : l'action inverse est lancée si l'utilisateur appuie à temps. */
export function showUndoToast(message: string, undo: () => Promise<unknown> | void): void {
  showToast(message, {
    label: i18n.t('toast.undo'),
    onPress: () => {
      Promise.resolve()
        .then(undo)
        .catch((e: unknown) => {
          logger.error(e, { where: 'undo' });
          showError(userMessageKey(e));
        });
    },
  });
}

/** À monter une fois, à la racine de l'app (au-dessus des écrans). */
export function ToastHost() {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = setEntry;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!entry) return;
    if (timer.current) clearTimeout(timer.current);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: false }).start();
    timer.current = setTimeout(
      () =>
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: false }).start(() =>
          setEntry((e) => (e?.id === entry.id ? null : e)),
        ),
      entry.action ? SHOW_WITH_ACTION_MS : SHOW_MS,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [entry, opacity]);

  if (!entry) return null;
  const act = () => {
    entry.action?.onPress();
    setEntry(null);
  };
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + TAB_BAR_HEIGHT,
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
      }}
    >
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          opacity,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          maxWidth: 480,
          backgroundColor: colors.text,
          borderRadius: radius.lg,
          paddingLeft: spacing.lg,
          paddingRight: entry.action ? spacing.xs : spacing.lg,
          paddingVertical: entry.action ? 0 : spacing.md,
          minHeight: minTouchSize,
          shadowColor: colors.text,
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <AppText numberOfLines={2} style={{ color: colors.background, flexShrink: 1 }}>
          {entry.message}
        </AppText>
        {entry.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={act}
            hitSlop={6}
            style={({ pressed }) => ({
              minHeight: minTouchSize,
              justifyContent: 'center',
              paddingHorizontal: spacing.md,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <AppText variant="bodyStrong" style={{ color: colors.primarySoft }}>
              {entry.action.label}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
