import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountsUnavailable } from '@/components/AccountsUnavailable';
import { accountMessageKey, sendPasswordReset, useAuth } from '@/modules/identity';
import { userMessageKey } from '@/shared/errors';
import { AppText, Card, FormScreen, TextField, fieldLimits, useSave } from '@/shared/ui';

/** Mot de passe oublié (§5.5) : un lien est envoyé par e-mail, il rouvre l'app pour choisir un nouveau mot de passe. */
export default function ForgotScreen() {
  const { t } = useTranslation();
  const { enabled } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sent, setSent] = useState(false);
  const { errors, saving, run } = useSave((e) => accountMessageKey(e, userMessageKey));

  if (!enabled) return <AccountsUnavailable />;

  return (
    <FormScreen
      submitLabel={t('auth.sendLink')}
      saving={saving}
      onSubmit={() =>
        run(async () => {
          await sendPasswordReset(email);
          setSent(true);
        })
      }
    >
      <Stack.Screen options={{ title: t('auth.forgotTitle') }} />
      <AppText color="muted">{t('auth.forgotHint')}</AppText>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email ?? errors._form}
        limit={fieldLimits.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      {sent ? (
        <Card>
          <AppText>{t('auth.linkSent')}</AppText>
        </Card>
      ) : null}
    </FormScreen>
  );
}
