import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { EmptyState } from './EmptyState';

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
};

/**
 * Chargement (lignes fantômes, jamais une liste vide trompeuse) ou erreur (message clair et
 * « Réessayer »), au même endroit qu'une liste.
 */
export function StateView({ state, onRetry, rows = 3 }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();

  if (state === 'error') {
    return (
      <EmptyState
        icon="alert-circle"
        tone="danger"
        title={t('state.errorTitle')}
        message={t('errors.loadFailed')}
        action={onRetry ? { label: t('errors.retry'), onPress: onRetry } : undefined}
      />
    );
  }

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
        padding: spacing.lg,
        gap: spacing.lg,
      }}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.sm,
              backgroundColor: colors.border,
            }}
          />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <View
              style={{
                height: 12,
                width: i % 2 === 0 ? '70%' : '55%',
                borderRadius: 6,
                backgroundColor: colors.border,
              }}
            />
            <View
              style={{ height: 10, width: '40%', borderRadius: 5, backgroundColor: colors.border }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
