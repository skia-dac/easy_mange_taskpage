import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { goBack } from '@/components/navigation';
import type { EditLoadState } from '@/hooks/useEditLoad';
import { useTheme } from '@/shared/theme';
import { EmptyState, StateView } from '@/shared/ui';

type Props = {
  state: Exclude<EditLoadState, 'ready'>;
  /** Relance une lecture échouée. */
  onRetry: () => void;
  /** Titre de l'écran (« Modifier… »), gardé pendant l'attente. */
  title?: string;
};

/**
 * Ce que montre un formulaire de modification tant que sa fiche n'est pas prête : chargement
 * (lignes fantômes), « Cet élément n'existe plus » avec « Retour », ou erreur avec « Réessayer ».
 * Jamais un formulaire vide intitulé « Modifier… ».
 */
export function EditLoadView({ state, onRetry, title }: Props) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const back = { label: t('common.back'), onPress: () => goBack() };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.xl,
        justifyContent: state === 'loading' ? 'flex-start' : 'center',
      }}
    >
      {title ? <Stack.Screen options={{ title }} /> : null}
      {state === 'missing' ? (
        <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} action={back} />
      ) : (
        <StateView
          state={state}
          onRetry={onRetry}
          rows={4}
          errorTitle={t('state.itemErrorTitle')}
          secondaryAction={back}
        />
      )}
    </View>
  );
}
