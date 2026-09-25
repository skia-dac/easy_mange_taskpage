import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AccountsUnavailable } from '@/components/AccountsUnavailable';
import { useLabels } from '@/hooks/useLabels';
import { accountMessageKey, getAccountOwner, getLastSyncAt, useAuth } from '@/modules/identity';
import { conflictCount, pendingCount, runSync, useSyncStatus } from '@/modules/platform';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDateTime } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceSheet,
  Chip,
  confirmDestructive,
  IconBadge,
  ListRow,
  LoadingScreen,
  SectionHeader,
  showError,
  TextButton,
} from '@/shared/ui';
import {
  deleteAccountEverywhere,
  replaceLocalDataWithAccount,
  signOutFromPhone,
} from '@/workflows';

/** Compte et synchronisation : état, synchroniser maintenant, déconnexion, suppression du compte (§5–6, §84–87). */
export default function AccountScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const { enabled, loading, userId, email } = useAuth();
  const sync = useSyncStatus();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const info = useLiveQuery(
    async (d) => ({
      owner: await getAccountOwner(d),
      last: await getLastSyncAt(d),
      pending: await pendingCount(d),
      conflicts: await conflictCount(d),
    }),
    [
      'app_settings',
      'sync_outbox',
      'sync_conflicts',
      'subjects',
      'notes',
      'tasks',
      'assignments',
      'exams',
      'habits',
      'habit_logs',
    ],
    [],
  );

  if (!enabled) return <AccountsUnavailable />;
  if (loading || info.loading) return <LoadingScreen />;

  const fail = (e: unknown) => showError(accountMessageKey(e, userMessageKey));
  const guard = async (job: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (!userId) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <Stack.Screen options={{ title: t('account.title') }} />
        <Card>
          <View style={{ gap: spacing.md }}>
            <IconBadge icon="cloud" size={48} />
            <AppText variant="heading">{t('account.why')}</AppText>
            <AppText color="muted">{t('account.whyHint')}</AppText>
          </View>
        </Card>
        <Button label={t('auth.createAccount')} onPress={() => router.push('/auth/sign-up')} />
        <Button
          variant="secondary"
          label={t('auth.signIn')}
          onPress={() => router.push('/auth/sign-in')}
        />
        <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
          {t('account.optional')}
        </AppText>
      </ScrollView>
    );
  }

  const d = info.data;
  const otherOwner = !!d?.owner && d.owner !== userId;
  const stateLabel =
    sync.state === 'syncing'
      ? t('sync.running')
      : sync.state === 'offline'
        ? t('sync.offline')
        : sync.state === 'error'
          ? t('sync.error')
          : d?.pending
            ? t('sync.pending', { count: d.pending })
            : t('sync.upToDate');
  const tone =
    sync.state === 'error'
      ? 'danger'
      : sync.state === 'offline' || d?.pending
        ? 'warning'
        : 'success';

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('account.title') }} />
      <Card>
        <ListRow
          title={email ?? ''}
          subtitle={t('account.signedIn')}
          leading={<IconBadge icon="user-check" color="success" background="successSoft" />}
        />
      </Card>

      {otherOwner ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <AppText variant="heading">{t('account.otherTitle')}</AppText>
            <AppText color="muted">{t('account.otherMessage')}</AppText>
            <Button
              label={t('account.otherConfirm')}
              onPress={() =>
                void guard(async () => {
                  const ok = await confirmDestructive(
                    t('account.otherTitle'),
                    t('account.otherMessage'),
                    t('account.otherConfirm'),
                  );
                  if (ok) await replaceLocalDataWithAccount(db, userId);
                })
              }
            />
          </View>
        </Card>
      ) : (
        <>
          <SectionHeader title={t('sync.title')} />
          <Card>
            <View style={{ gap: spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  flexWrap: 'wrap',
                }}
              >
                <Chip label={stateLabel} tone={tone} />
              </View>
              <AppText variant="caption" color="muted">
                {d?.last
                  ? t('sync.last', { date: formatDateTime(new Date(d.last), labels.lang) })
                  : t('sync.never')}
              </AppText>
              {d?.conflicts ? (
                <AppText variant="caption" color="muted">
                  {t('sync.conflicts', { count: d.conflicts })}
                </AppText>
              ) : null}
              <Button
                label={t('sync.now')}
                onPress={() => void runSync(db, userId)}
                disabled={sync.state === 'syncing'}
              />
              <AppText variant="caption" color="muted">
                {t('sync.hint')}
              </AppText>
            </View>
          </Card>
        </>
      )}

      <SectionHeader title={t('account.security')} />
      <Card>
        <ListRow
          title={t('auth.changePassword')}
          leading={<IconBadge icon="key" />}
          onPress={() => router.push('/auth/reset')}
        />
        <ListRow
          title={t('privacy.open')}
          leading={<IconBadge icon="shield" color="success" background="successSoft" />}
          onPress={() => router.push('/privacy')}
        />
      </Card>

      <Button
        variant="secondary"
        label={t('account.signOut')}
        onPress={() => setSheet(true)}
        disabled={busy}
      />
      <TextButton
        label={t('account.delete')}
        color="danger"
        onPress={() =>
          void guard(async () => {
            const first = await confirmDestructive(
              t('account.deleteTitle'),
              t('account.deleteMessage'),
              t('account.deleteContinue'),
            );
            if (!first) return;
            const second = await confirmDestructive(
              t('account.deleteAgainTitle'),
              t('account.deleteAgainMessage'),
              t('account.deleteConfirm'),
            );
            if (!second) return;
            await deleteAccountEverywhere(db);
            router.replace('/onboarding');
          })
        }
      />

      <ChoiceSheet
        visible={sheet}
        title={t('account.signOut')}
        message={t('account.signOutHint')}
        options={[
          {
            label: t('account.signOutKeep'),
            hint: t('account.signOutKeepHint'),
            onPress: () => void guard(() => signOutFromPhone(db, true)),
          },
          {
            label: t('account.signOutErase'),
            hint: t('account.signOutEraseHint'),
            destructive: true,
            onPress: () =>
              void guard(async () => {
                await signOutFromPhone(db, false);
                router.replace('/onboarding');
              }),
          },
        ]}
        onClose={() => setSheet(false)}
      />
    </ScrollView>
  );
}
