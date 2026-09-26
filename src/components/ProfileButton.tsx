import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { useProfile } from '@/hooks/useProfile';
import { initials } from '@/modules/identity';
import { attachmentUri } from '@/modules/platform';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText } from '@/shared/ui';

/** Ta photo (ou tes initiales) en haut à droite de chaque onglet : ouvre le Profil. */
export function ProfileButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useProfile();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('profile.title')}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => ({
        width: minTouchSize,
        height: minTouchSize,
        borderRadius: minTouchSize / 2,
        borderWidth: 2,
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: pressed ? 0.7 : 1,
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
    </Pressable>
  );
}
