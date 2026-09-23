import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Props = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

/** Libellé + champ + message d'erreur (traduit) sous le champ. */
export function FieldShell({ label, required, error, hint, children }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <AppText variant="caption" color="muted">
        {label}
        {required ? (
          <AppText variant="caption" color="danger">
            {' '}
            *
          </AppText>
        ) : null}
      </AppText>
      {children}
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {t(error)}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
