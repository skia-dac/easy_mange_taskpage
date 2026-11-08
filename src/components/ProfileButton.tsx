import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConflictCount } from '@/hooks/useConflictCount';
import { useProfile } from '@/hooks/useProfile';
import { initials } from '@/modules/identity';
import { attachmentUri } from '@/modules/platform';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Tappable } from '@/shared/ui';

/** Pastille rouge sur la photo : conflits de synchronisation à régler (dans Profil › Compte). */
export function ConflictBadge({ count }: { count: number }) {
  const { colors, spacing } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID="conflict-badge"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        paddingHorizontal: spacing.xxs,
        backgroundColor: colors.danger,
        borderWidth: 2,
        borderColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="caption" color="onPrimary">
        {count > 9 ? '9+' : String(count)}
      </AppText>
    </View>
  );
}

/** Ta photo (ou tes initiales) en haut à droite de chaque onglet : ouvre le Profil. */
export function ProfileButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();
  const conflicts = useConflictCount() ?? 0;
  return (
    <View>
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={
          conflicts > 0
            ? `${t('profile.title')}, ${t('conflicts.badge', { count: conflicts })}`
            : t('profile.title')
        }
        onPress={() => router.push('/profile')}
        style={() => ({
          width: minTouchSize,
          height: minTouchSize,
          borderRadius: minTouchSize / 2,
          borderWidth: 2,
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        })}
      >
        {profile?.photoPath ? (
          <Image
            source={{ uri: attachmentUri(profile.photoPath) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <AppText variant="bodyStrong" color="primary">
            {initials(profile) || '?'}
          </AppText>
        )}
      </Tappable>
      <View pointerEvents="none" style={{ position: 'absolute', top: -4, right: -4 }}>
        <ConflictBadge count={conflicts} />
      </View>
    </View>
  );
}
