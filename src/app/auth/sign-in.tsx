import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AccountsUnavailable } from '@/components/AccountsUnavailable';
import { AuthButtons } from '@/components/AuthButtons';
import { useAfterSignIn } from '@/hooks/useAfterSignIn';
import { accountMessageKey, signIn, useAuth } from '@/modules/identity';
import { userMessageKey } from '@/shared/errors';
import { FormScreen, TextButton, TextField, useSave } from '@/shared/ui';

/** Connexion par e-mail et mot de passe, ou avec Apple / Google (§5.2–5.4). */
export default function SignInScreen() {
  const { t } = useTranslation();
  const { enabled } = useAuth();
  const after = useAfterSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { errors, saving, run } = useSave((e) => accountMessageKey(e, userMessageKey));

  if (!enabled) return <AccountsUnavailable />;

  return (
    <FormScreen
      submitLabel={t('auth.signIn')}
      saving={saving}
      onSubmit={() =>
        run(async () => {
          await signIn({ email, password });
          await after();
        })
      }
      footer={
        <>
          <TextButton
            label={t('auth.forgot')}
            onPress={() => router.push({ pathname: '/auth/forgot', params: { email } })}
          />
          <TextButton label={t('auth.noAccount')} onPress={() => router.replace('/auth/sign-up')} />
          <AuthButtons onSignedIn={after} />
        </>
      }
    >
      <Stack.Screen options={{ title: t('auth.signInTitle') }} />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoFocus
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
    </FormScreen>
  );
}
