import Feather from '@expo/vector-icons/Feather';
import { router, Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { getSupabase } from '@/modules/identity';
import {
  deleteFeedback,
  FEEDBACK_TABLE,
  listFeedback,
  previewOf,
  retryFeedback,
  type Feedback,
  type FeedbackKind,
} from '@/modules/platform';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDateTime } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  confirmDestructive,
  EmptyState,
  showError,
  showToast,
  TextButton,
} from '@/shared/ui';

const KIND_ICONS: Record<FeedbackKind, ComponentProps<typeof Feather>['name']> = {
  bug: 'alert-triangle',
  idea: 'zap',
  other: 'message-circle',
};

/** « Mes retours » : ce qui a été envoyé, ce qui attend encore. */
export default function FeedbackHistoryScreen() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const list = useLiveQuery(listFeedback, [FEEDBACK_TABLE], []);
  const [busy, setBusy] = useState(false);
  const items = list.data ?? [];
  const pending = items.filter((f) => f.status === 'pending').length;

  const retry = async () => {
    setBusy(true);
    try {
      const report = await retryFeedback(db, getSupabase());
      showToast(t(report.sent > 0 ? 'feedback.retrySent' : 'feedback.retryStill'));
    } catch (e) {
      showError(userMessageKey(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (f: Feedback) => {
    const ok = await confirmDestructive(
      t('feedback.deleteTitle'),
      t('feedback.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteFeedback(db, f.id);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('feedback.historyTitle') }} />
      {pending > 0 ? (
        <Button label={t('feedback.retry')} onPress={() => void retry()} disabled={busy} />
      ) : null}
      {list.data && items.length === 0 ? (
        <EmptyState
          icon="message-square"
          title={t('feedback.emptyTitle')}
          message={t('feedback.emptyMessage')}
        />
      ) : null}
      {items.map((f) => (
        <Card key={f.id}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primarySoft,
              }}
            >
              <Feather name={KIND_ICONS[f.kind]} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="bodyStrong">
                {t(`feedback.kind.${f.kind}.title`)} · {t(`feedback.area.${f.area}`)}
              </AppText>
              <AppText numberOfLines={2}>{previewOf(f.message)}</AppText>
              <AppText variant="caption" color="muted">
                {formatDateTime(new Date(f.createdAt), i18n.language)}
              </AppText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Chip
                  label={t(`feedback.status.${f.status}`)}
                  tone={f.status === 'sent' ? 'success' : 'warning'}
                />
                {f.status === 'pending' ? (
                  <TextButton
                    label={t('common.delete')}
                    color="danger"
                    onPress={() => void remove(f)}
                  />
                ) : null}
              </View>
            </View>
          </View>
        </Card>
      ))}
      <TextButton label={t('feedback.write')} onPress={() => router.push('/feedback')} />
    </ScrollView>
  );
}
