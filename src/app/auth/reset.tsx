import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  accountMessageKey,
  completeFromUrl,
  PASSWORD_MIN,
  redirectUrl,
  updatePassword,
  useAuth,
} from '@/modules/identity';
import { userMessageKey } from '@/shared/errors';
import { EmptyState, FormScreen, LoadingScreen, showInfo, TextField, useSave } from '@/shared/ui';

/**
 * Nouveau mot de passe : après le lien « mot de passe oublié » (`code`),
 * ou depuis la page du compte quand on est déjà connecté.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();
  const [ready, setReady] = useState(!params.code);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const { errors, saving, run } = useSave((e) => accountMessageKey(e, userMessageKey));

  useEffect(() => {
    if (!params.code) return;
    completeFromUrl(`${redirectUrl('auth/reset')}?code=${encodeURIComponent(params.code)}`)
      .then(() => setReady(true))
      .catch((e: unknown) => setLinkError(accountMessageKey(e, userMessageKey)));
  }, [params.code]);

  if (linkError) return <EmptyState icon="alert-circle" title={t(linkError)} />;
  if (!ready) return <LoadingScreen />;
  if (!session) return <EmptyState icon="lock" title={t('auth.error.linkExpired')} />;

  return (
    <FormScreen
      submitLabel={t('auth.savePassword')}
      saving={saving}
      onSubmit={() =>
        run(async () => {
          await updatePassword(form);
          showInfo(t('auth.passwordSavedTitle'), t('auth.passwordSaved'));
          router.dismissTo('/account');
        })
      }
    >
      <Stack.Screen options={{ title: t('auth.newPasswordTitle') }} />
      <TextField
        label={t('auth.newPassword')}
        value={form.password}
        onChangeText={(password) => setForm((f) => ({ ...f, password }))}
        error={errors.password}
        hint={t('auth.passwordRules', { min: PASSWORD_MIN })}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
      />
      <TextField
        label={t('auth.confirm')}
        value={form.confirm}
        onChangeText={(confirm) => setForm((f) => ({ ...f, confirm }))}
        error={errors.confirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
    </FormScreen>
  );
}
