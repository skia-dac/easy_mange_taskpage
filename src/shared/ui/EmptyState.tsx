import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { RiseIn } from './RiseIn';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  message?: string;
};

/** État vide clair et rassurant (spécification §88). */
export function EmptyState({ icon, title, message }: Props) {
  const { colors, spacing, radius } = useTheme();
  return (
    <RiseIn>
      <View
        accessible
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.xxl,
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.xl,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xs,
          }}
        >
          <Feather name={icon} size={30} color={colors.primary} />
        </View>
        <AppText variant="heading" style={{ textAlign: 'center' }}>
          {title}
        </AppText>
        {message ? (
          <AppText color="muted" style={{ textAlign: 'center' }}>
            {message}
          </AppText>
        ) : null}
      </View>
    </RiseIn>
  );
}
