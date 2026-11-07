import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme, type ColorTokens } from '../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import { RiseIn } from './RiseIn';

type Action = { label: string; onPress: () => void };

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  title: string;
  message?: string;
  /** Première action guidée (« Nouvelle tâche », « Réessayer »…). */
  action?: Action;
  /** Seconde action, plus discrète. */
  secondaryAction?: Action;
  /** Ton de l'icône (`danger` pour une erreur). */
  tone?: 'primary' | 'danger';
};

const TONES: Record<'primary' | 'danger', { fg: keyof ColorTokens; bg: keyof ColorTokens }> = {
  primary: { fg: 'primary', bg: 'primarySoft' },
  danger: { fg: 'danger', bg: 'dangerSoft' },
};

/** État vide clair et rassurant (spécification §88), avec au besoin une action pour démarrer. */
export function EmptyState({
  icon,
  title,
  message,
  action,
  secondaryAction,
  tone = 'primary',
}: Props) {
  const { colors, spacing, radius } = useTheme();
  const { fg, bg } = TONES[tone];
  return (
    <RiseIn>
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.xxl,
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {/* Icône, titre et message se lisent d'un bloc ; les boutons restent atteignables seuls. */}
        <View accessible style={{ alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.xl,
              backgroundColor: colors[bg],
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.xs,
            }}
          >
            <Feather name={icon} size={30} color={colors[fg]} />
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
        {action || secondaryAction ? (
          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
            {action ? <Button label={action.label} onPress={action.onPress} /> : null}
            {secondaryAction ? (
              <Button
                label={secondaryAction.label}
                variant="secondary"
                onPress={secondaryAction.onPress}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </RiseIn>
  );
}
