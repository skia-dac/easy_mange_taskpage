import Feather from '@expo/vector-icons/Feather';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Alert, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { userMessageKey } from '../errors';
import { i18n } from '../i18n';
import { logger } from '../logger';
import { useMeasuredTabBarHeight } from '../tabBarVisibility';
import { minTouchSize, useTheme, type ColorTokens } from '../theme';
import { AppText } from './AppText';
import { haptic } from './haptics';
import { Tappable } from './Tappable';
import {
  reportToastHeight,
  toastIsCovered,
  TOAST_BOTTOM_GAP,
  TOAST_SIDE_MARGIN,
} from './toastLayout';
import { useKeyboardHeight } from './useKeyboardHeight';
import { useLineLimit } from './useLargeText';
import { useScreenReader } from './useScreenReader';

export type ToastAction = { label: string; onPress: () => void };
/** Nature du message : elle choisit l'icône (réussi, information, attention, erreur). */
export type ToastTone = 'success' | 'info' | 'warning' | 'error';
/**
 * Texte du message : une phrase, ou un titre court (« Payé ») et le détail dessous (le nom de
 * l'élément). Le titre dit ce qui s'est passé, le détail à quoi.
 */
export type ToastContent = string | { title: string; detail?: string };
export type ToastOptions = { action?: ToastAction; tone?: ToastTone };

type Entry = {
  id: number;
  title: string;
  detail?: string;
  action?: ToastAction;
  tone: ToastTone;
};

/** Durée d'affichage : plus longue quand il y a un bouton (le temps de le lire et d'appuyer). */
const SHOW_MS = 3500;
const SHOW_WITH_ACTION_MS = 6000;
/** Une erreur se lit en entier (deux phrases parfois) : elle reste aussi longtemps. */
const SHOW_ERROR_MS = SHOW_WITH_ACTION_MS;
/** Après un appui long sur le message, il reste encore au moins ce temps une fois le doigt levé. */
const AFTER_HOLD_MIN_MS = 1500;
/**
 * Lecteur d'écran allumé : il faut le temps d'entendre le message puis d'aller jusqu'au bouton.
 * Un message seul reste 20 s ; un message avec bouton ne part plus tout seul (WCAG 2.2.1) :
 * il attend « Annuler », « Fermer » ou le message suivant.
 */
export const SCREEN_READER_SHOW_MS = 20000;
/** Hauteur de la barre d'onglets (sans l'inset) tant qu'elle n'a pas été mesurée. */
const TAB_BAR_FALLBACK = 56;
/** Arrivée et départ : courts (Material 3 : 150 à 250 ms). */
const MOTION_MS = 200;
/** Glisser pour fermer : distance ou vitesse à partir de laquelle le message part. */
const SWIPE_X = 80;
const SWIPE_Y = 36;
const SWIPE_VELOCITY = 700;

const icons: Record<ToastTone, ComponentProps<typeof Feather>['name']> = {
  success: 'check-circle',
  info: 'info',
  warning: 'alert-triangle',
  error: 'alert-circle',
};
const iconColors: Record<ToastTone, keyof ColorTokens> = {
  success: 'inverseSuccess',
  info: 'inversePrimary',
  warning: 'inverseWarning',
  error: 'inverseDanger',
};

let listener: ((entry: Entry) => void) | null = null;
/** L'écran affiché est une fenêtre native (« Ajouter ») : le message serait caché dessous. */
let hostCovered = false;
let seq = 0;

/**
 * Message discret en bas de l'écran, non bloquant, avec au plus un bouton. Sans `ToastHost`
 * monté (tests), il ne fait rien.
 *
 * `showToast({ title: 'Payé', detail: 'Loyer' }, { tone: 'success' })` ; l'ancienne forme
 * `showToast('Texte', action?)` marche toujours (ton « info »).
 */
export function showToast(content: ToastContent, options?: ToastAction | ToastOptions): void {
  const opts: ToastOptions = options && 'label' in options ? { action: options } : (options ?? {});
  const { title, detail } = typeof content === 'string' ? { title: content } : content;
  listener?.({
    id: ++seq,
    title,
    detail: detail?.trim() ? detail : undefined,
    action: opts.action,
    tone: opts.tone ?? 'info',
  });
}

/**
 * Message + « Annuler » : l'action inverse est lancée si l'utilisateur appuie à temps. Ton
 * « réussi » par défaut : on annule une action qui vient de réussir.
 */
export function showUndoToast(
  content: ToastContent,
  undo: () => Promise<unknown> | void,
  options?: { tone?: ToastTone },
): void {
  showToast(content, {
    tone: options?.tone ?? 'success',
    action: {
      label: i18n.t('toast.undo'),
      onPress: () => {
        Promise.resolve()
          .then(undo)
          .catch((e: unknown) => {
            logger.error(e, { where: 'undo' });
            showErrorToast(userMessageKey(e));
          });
      },
    },
  });
}

/** Un message peut s'afficher maintenant (hôte monté, aucune fenêtre par-dessus). */
export function canShowToast(): boolean {
  return listener !== null && !hostCovered && !toastIsCovered();
}

/**
 * « Impossible d'enregistrer pour le moment. Tes données n'ont pas été perdues. » devient le titre
 * « Impossible d'enregistrer pour le moment » et le détail « Tes données n'ont pas été perdues. ».
 */
export function splitMessage(text: string): { title: string; detail?: string } {
  const m = /^(.+?[.!?…])\s+(\S[\s\S]*)$/u.exec(text.trim());
  if (!m) return { title: text.trim().replace(/\.$/, '') };
  return { title: m[1]!.replace(/\.$/, ''), detail: m[2] };
}

/**
 * Erreur non bloquante : un message « erreur » en bas de l'écran. Si une fenêtre le cacherait
 * (ou sans hôte, en test), une alerte native à la place : une erreur n'est jamais perdue.
 */
export function showErrorToast(messageKey: string): void {
  const message = i18n.t(messageKey);
  if (!canShowToast()) {
    Alert.alert(i18n.t('errors.title'), message);
    return;
  }
  showToast(splitMessage(message), { tone: 'error' });
}

function durationFor(entry: Entry, reader: boolean): number | null {
  if (reader) return entry.action ? null : SCREEN_READER_SHOW_MS;
  if (entry.action) return SHOW_WITH_ACTION_MS;
  return entry.tone === 'error' ? SHOW_ERROR_MS : SHOW_MS;
}

/** À monter une fois, à la racine de l'app (au-dessus des écrans). */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const segment = useSegments()[0];
  // Sur un écran de pile (réglages, formulaire…), pas de barre d'onglets : le message descend.
  const onTabs = segment === '(tabs)';
  const measuredTabBar = useMeasuredTabBarHeight();
  const reader = useScreenReader();
  const keyboard = useKeyboardHeight();
  const [entry, setEntry] = useState<Entry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Temps restant, et moment où il a commencé à courir (pause tant que le doigt est posé).
  const remaining = useRef<number | null>(null);
  const startedAt = useRef(0);
  const held = useRef(false);

  useEffect(() => {
    listener = setEntry;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    hostCovered = segment === 'add';
    return () => {
      hostCovered = false;
    };
  }, [segment]);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const dismiss = useCallback((id: number) => {
    setEntry((e) => (e?.id === id ? null : e));
  }, []);

  const run = useCallback(
    (id: number, ms: number) => {
      if (timer.current) clearTimeout(timer.current);
      remaining.current = ms;
      startedAt.current = Date.now();
      timer.current = setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  useEffect(() => {
    if (!entry) return;
    // iOS ne lit pas un « alert » qui apparaît : on l'annonce explicitement (Android aussi, sans double).
    AccessibilityInfo.announceForAccessibility(
      [entry.title, entry.detail, entry.action?.label].filter(Boolean).join(' '),
    );
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    held.current = false;
    const duration = durationFor(entry, reader);
    if (duration === null) {
      clear();
      remaining.current = null;
      return;
    }
    run(entry.id, duration);
    return clear;
  }, [entry, reader, run]);

  // Plus de message : le bouton + redescend.
  useEffect(() => {
    if (!entry) reportToastHeight(0);
  }, [entry]);
  useEffect(() => () => reportToastHeight(0), []);

  /** Doigt posé sur le message : le temps s'arrête ; levé, il repart (jamais moins de 1,5 s). */
  const hold = useCallback(() => {
    if (held.current || remaining.current === null || !timer.current) return;
    held.current = true;
    clear();
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }, []);
  const release = useCallback(() => {
    if (!held.current || !entry) return;
    held.current = false;
    if (remaining.current === null) return;
    run(entry.id, Math.max(remaining.current, AFTER_HOLD_MIN_MS));
  }, [entry, run]);

  const tabBar = measuredTabBar > 0 ? measuredTabBar : insets.bottom + TAB_BAR_FALLBACK;
  // Juste au-dessus de la barre d'onglets (ou de la barre d'accueil hors des onglets) ; le bouton +
  // remonte pour lui faire de la place (voir `useToastHeight`).
  const resting = (onTabs ? tabBar : insets.bottom) + TOAST_BOTTOM_GAP;
  // Clavier ouvert : le message se pose juste au-dessus, jamais dessous.
  const aboveKeyboard = keyboard > 0 && keyboard + TOAST_BOTTOM_GAP > resting;
  const bottom = aboveKeyboard ? keyboard + TOAST_BOTTOM_GAP : resting;

  useEffect(() => {
    // Au-dessus du clavier, le bouton + est caché dessous : il ne bouge pas.
    if (aboveKeyboard) reportToastHeight(0);
  }, [aboveKeyboard]);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: TOAST_SIDE_MARGIN,
        right: TOAST_SIDE_MARGIN,
        bottom,
        alignItems: 'center',
      }}
    >
      {entry ? (
        <ToastCard
          key={entry.id}
          entry={entry}
          sticky={reader && !!entry.action}
          onLayoutHeight={(h) => reportToastHeight(aboveKeyboard ? 0 : h)}
          onDismiss={() => dismiss(entry.id)}
          onHold={hold}
          onRelease={release}
        />
      ) : null}
    </View>
  );
}

function ToastCard({
  entry,
  sticky,
  onLayoutHeight,
  onDismiss,
  onHold,
  onRelease,
}: {
  entry: Entry;
  sticky: boolean;
  onLayoutHeight: (height: number) => void;
  onDismiss: () => void;
  onHold: () => void;
  onRelease: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing, scheme } = useTheme();
  const reduced = useReducedMotion();
  // Très grand texte : le message entier, sur autant de lignes qu'il faut.
  const messageLines = useLineLimit(2);
  const titleLines = useLineLimit(1);
  // Le nom d'un élément tient sur une ligne (« … ») ; une phrase d'erreur sur deux.
  const detailLines = useLineLimit(entry.tone === 'error' || entry.tone === 'warning' ? 2 : 1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const fade = useSharedValue(1);

  const act = () => {
    haptic('selection');
    entry.action?.onPress();
    onDismiss();
  };

  const settle = (x: number, y: number, vx: number, vy: number) => {
    'worklet';
    const sideways = Math.abs(x) > SWIPE_X || Math.abs(vx) > SWIPE_VELOCITY;
    const down = y > SWIPE_Y || vy > SWIPE_VELOCITY;
    if (!sideways && !down) {
      dragX.set(reduced ? 0 : withSpring(0, { damping: 20, stiffness: 260 }));
      dragY.set(reduced ? 0 : withSpring(0, { damping: 20, stiffness: 260 }));
      return;
    }
    if (reduced) {
      scheduleOnRN(onDismiss);
      return;
    }
    if (sideways) dragX.set(withTiming(Math.sign(x || vx) * 480, { duration: 180 }));
    else dragY.set(withTiming(160, { duration: 180 }));
    fade.set(
      withTiming(0, { duration: 180 }, (finished) => {
        if (finished) scheduleOnRN(onDismiss);
      }),
    );
  };

  // Glisser vers le bas ou sur le côté pour fermer (iOS, Android). Le doigt posé met le temps en pause.
  const swipe = Gesture.Pan()
    .withTestId('toast-swipe')
    .activeOffsetX([-12, 12])
    .activeOffsetY(12)
    .onBegin(() => {
      'worklet';
      scheduleOnRN(onHold);
    })
    .onUpdate((e) => {
      'worklet';
      const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      dragX.set(horizontal ? e.translationX : 0);
      // Vers le haut : à peine (le message ne part pas par là).
      dragY.set(horizontal ? 0 : e.translationY > 0 ? e.translationY : e.translationY / 6);
    })
    .onEnd((e) => {
      'worklet';
      const horizontal = Math.abs(e.translationX) > Math.abs(e.translationY);
      settle(
        horizontal ? e.translationX : 0,
        horizontal ? 0 : e.translationY,
        horizontal ? e.velocityX : 0,
        horizontal ? 0 : e.velocityY,
      );
    })
    .onFinalize(() => {
      'worklet';
      scheduleOnRN(onRelease);
    });

  const dragStyle = useAnimatedStyle(() => ({
    opacity: fade.get() * (1 - Math.min(0.6, Math.abs(dragX.get()) / 400)),
    transform: [{ translateX: dragX.get() }, { translateY: dragY.get() }],
  }));

  // Monte en apparaissant, redescend en partant ; animations coupées : un simple fondu.
  const entering = reduced
    ? FadeIn.duration(MOTION_MS).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(MOTION_MS);
  const exiting = reduced
    ? FadeOut.duration(MOTION_MS).reduceMotion(ReduceMotion.Never)
    : FadeOutDown.duration(MOTION_MS);

  const iconName = icons[entry.tone];
  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      onLayout={(e) => onLayoutHeight(e.nativeEvent.layout.height)}
      testID="toast-frame"
      style={{ width: '100%', maxWidth: 560 }}
    >
      <GestureDetector gesture={swipe}>
        <Animated.View
          accessibilityRole="alert"
          testID="toast"
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.inverseSurface,
              borderRadius: radius.md,
              paddingLeft: spacing.lg,
              paddingRight: entry.action || sticky ? spacing.xs : spacing.lg,
              paddingVertical: spacing.xs,
              minHeight: minTouchSize + spacing.sm,
              gap: spacing.md,
              // Ombre douce (iOS) ; élévation Material (Android).
              shadowColor: colors.shadow,
              shadowOpacity: scheme === 'dark' ? 0.45 : 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            },
            dragStyle,
          ]}
        >
          <View
            testID={`toast-icon-${entry.tone}`}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Feather name={iconName} size={20} color={colors[iconColors[entry.tone]]} />
          </View>
          <View style={{ flex: 1, paddingVertical: spacing.sm, gap: spacing.xxs }}>
            {entry.detail ? (
              <>
                <AppText variant="bodyStrong" color="onInverseSurface" numberOfLines={titleLines}>
                  {entry.title}
                </AppText>
                <AppText variant="caption" color="inverseMuted" numberOfLines={detailLines}>
                  {entry.detail}
                </AppText>
              </>
            ) : (
              <AppText color="onInverseSurface" numberOfLines={messageLines}>
                {entry.title}
              </AppText>
            )}
          </View>
          {entry.action ? (
            <Tappable
              accessibilityRole="button"
              onPress={act}
              hitSlop={4}
              style={() => ({
                minHeight: minTouchSize,
                minWidth: minTouchSize,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                borderRadius: radius.sm,
              })}
            >
              <AppText variant="bodyStrong" color="inversePrimary">
                {entry.action.label}
              </AppText>
            </Tappable>
          ) : null}
          {sticky ? (
            <Tappable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={onDismiss}
              style={{
                width: minTouchSize,
                height: minTouchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="x" size={18} color={colors.onInverseSurface} />
            </Tappable>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
