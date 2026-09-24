import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Props = { message?: string };

/**
 * Écran d'attente plein écran (ouverture de la base, vérification du premier lancement…).
 * Remplace l'écran vide : l'utilisateur voit que l'app travaille.
 */
export function LoadingScreen({ message }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
        padding: spacing.xxl,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <AppText color="muted" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}
