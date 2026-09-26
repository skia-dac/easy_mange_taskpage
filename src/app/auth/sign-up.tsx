import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AccountsUnavailable } from '@/components/AccountsUnavailable';
import { AuthButtons } from '@/components/AuthButtons';
import { useAfterSignIn } from '@/hooks/useAfterSignIn';
import { accountMessageKey, PASSWORD_MIN, signUp, useAuth } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  FormScreen,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
} from '@/shared/ui';
import { fillProfileFromSignUp } from '@/workflows';

/** Création de compte (§5.1). Le compte est facultatif : l'app marche aussi sans. */
export default function SignUpScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const { enabled } = useAuth();
  const after = useAfterSignIn();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { errors, saving, run } = useSave((e) => accountMessageKey(e, userMessageKey));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  if (!enabled) return <AccountsUnavailable />;

  if (sentTo) {
    return (
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
        <Stack.Screen options={{ title: t('auth.signUpTitle') }} />
        <Card>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">{t('auth.checkMailTitle')}</AppText>
            <AppText>{t('auth.checkMail', { email: sentTo })}</AppText>
          </View>
        </Card>
        <Button label={t('auth.signIn')} onPress={() => router.replace('/auth/sign-in')} />
      </View>
    );
  }

  return (
    <FormScreen
      submitLabel={t('auth.createAccount')}
      saving={saving}
      onSubmit={() =>
        run(async () => {
          const { needsConfirmation } = await signUp(form);
          await fillProfileFromSignUp(db, form);
          if (needsConfirmation) setSentTo(form.email.trim().toLowerCase());
          else await after();
        })
      }
      footer={
        <>
          <TextButton
            label={t('auth.haveAccount')}
            onPress={() => router.replace('/auth/sign-in')}
          />
          <AuthButtons onSignedIn={after} />
          <TextButton
            label={t('privacy.open')}
            color="muted"
            onPress={() => router.push('/privacy')}
          />
        </>
      }
    >
      <Stack.Screen options={{ title: t('auth.signUpTitle') }} />
      <AppText color="muted">{t('auth.signUpHint')}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profile.firstName')}
            value={form.firstName}
            onChangeText={(firstName) => set({ firstName })}
            error={errors.firstName}
            limit={fieldLimits.firstName}
            autoComplete="given-name"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profile.lastName')}
            value={form.lastName}
            onChangeText={(lastName) => set({ lastName })}
            error={errors.lastName}
            limit={fieldLimits.lastName}
            autoComplete="family-name"
          />
        </View>
      </View>
      <TextField
        label={t('auth.email')}
        required
        value={form.email}
        onChangeText={(email) => set({ email })}
        error={errors.email}
        limit={fieldLimits.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        required
        value={form.password}
        onChangeText={(password) => set({ password })}
        error={errors.password}
        limit={fieldLimits.newPassword}
        hint={t('auth.passwordRules', { min: PASSWORD_MIN })}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.confirm')}
        required
        value={form.confirm}
        onChangeText={(confirm) => set({ confirm })}
        error={errors.confirm}
        limit={fieldLimits.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AppText variant="caption" color="muted">
        {t('auth.privacyNotice')}
      </AppText>
    </FormScreen>
  );
}
