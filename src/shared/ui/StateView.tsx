import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { bodyMaxFontSizeMultiplier, minTouchSize, useTheme } from '../theme';
import { EmptyState } from './EmptyState';
import { useTextScale } from './useLargeText';

/** Ce qu'une lecture permet d'afficher : en attente, en échec, ou prête. */
export type LoadState = 'loading' | 'error' | 'ready';

/**
 * Une lecture sans données encore : chargement, ou échec si elle a échoué. Avec des données
 * (même anciennes), l'écran les montre : une relecture ratée ne vide jamais la liste.
 */
export function loadStateOf(query: { data: unknown; error: unknown }): LoadState {
  if (query.data !== undefined) return 'ready';
  return query.error ? 'error' : 'loading';
}

type Props = {
  state: Exclude<LoadState, 'ready'>;
  /** Relance la lecture (bouton « Réessayer »). */
  onRetry?: () => void;
  /** Nombre de lignes fantômes pendant le chargement. */
  rows?: number;
  /** Titre de l'erreur (par défaut : « Impossible d'afficher cette liste »). */
  errorTitle?: string;
  /** Seconde action de l'erreur, plus discrète (ex. « Retour »). */
  secondaryAction?: { label: string; onPress: () => void };
};

/** Largeurs des titres fantômes, pour que les lignes ne soient pas toutes pareilles. */
const TITLE_WIDTHS: DimensionValue[] = ['72%', '58%', '66%', '50%'];
const SUBTITLE_WIDTHS: DimensionValue[] = ['40%', '48%', '34%', '44%'];

/** Battement lent : le fantôme respire, sans balayage qui fatiguerait l'œil. */
const PULSE_MS = 900;
const PULSE_LOW = 0.5;

function pulse(opacity: SharedValue<number>) {
  opacity.value = withRepeat(
    withTiming(PULSE_LOW, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }),
    -1,
    true,
  );
}

function stop(opacity: SharedValue<number>) {
  cancelAnimation(opacity);
  opacity.value = 1;
}

/**
 * Chargement (une carte de lignes fantômes à la taille des vraies lignes, jamais une liste vide
 * trompeuse) ou erreur (message clair et « Réessayer »), au même endroit qu'une liste.
 */
export function StateView({ state, onRetry, rows = 3, errorTitle, secondaryAction }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing, text } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  // Les barres suivent la taille du texte : le fantôme a la hauteur de la ligne qui viendra.
  const k = Math.min(useTextScale(), bodyMaxFontSizeMultiplier);
  const loading = state === 'loading';

  useEffect(() => {
    if (!loading || reduced) {
      stop(opacity);
      return;
    }
    pulse(opacity);
    return () => stop(opacity);
  }, [loading, opacity, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (state === 'error') {
    return (
      <EmptyState
        icon="alert-circle"
        tone="danger"
        title={errorTitle ?? t('state.errorTitle')}
        message={t('errors.loadFailed')}
        action={onRetry ? { label: t('errors.retry'), onPress: onRetry } : undefined}
        secondaryAction={secondaryAction}
      />
    );
  }

  const titleLine = text.bodyStrong.lineHeight * k;
  const subtitleLine = text.caption.lineHeight * k;
  const bar = (line: number, width: DimensionValue) => (
    <View style={{ height: line, justifyContent: 'center' }}>
      <View
        style={{
          height: Math.round(line * 0.55),
          width,
          borderRadius: radius.pill,
          backgroundColor: colors.skeleton,
        }}
      />
    </View>
  );

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('state.loading')}
      accessibilityState={{ busy: true }}
      testID="state-loading"
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
      }}
    >
      <Animated.View style={pulseStyle}>
        {Array.from({ length: rows }, (_, i) => (
          <View
            key={i}
            testID="state-loading-row"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              minHeight: minTouchSize + spacing.sm,
              paddingVertical: spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm,
                backgroundColor: colors.skeleton,
              }}
            />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              {bar(titleLine, TITLE_WIDTHS[i % TITLE_WIDTHS.length] ?? '60%')}
              {bar(subtitleLine, SUBTITLE_WIDTHS[i % SUBTITLE_WIDTHS.length] ?? '40%')}
            </View>
            <View
              style={{
                width: 48,
                height: Math.round(subtitleLine * 0.9),
                borderRadius: radius.pill,
                backgroundColor: colors.skeletonHighlight,
              }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
