import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  openNotificationSettings,
  useNotificationPermission,
} from '@/hooks/useNotificationPermission';
import type { NotificationPreferences } from '@/modules/identity';
import {
  getReminderRunStatus,
  REMINDER_STATUS_KEY,
  reminderStatusView,
  remindersPaused,
  type ReminderStatusView,
} from '@/modules/platform';
import { settingTable, useLiveQuery } from '@/shared/db';
import { formatDateTime, formatDayMonth } from '@/shared/format';
import { useSpaces } from '@/shared/SpacesContext';
import type { ColorTokens } from '@/shared/theme';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, TextButton } from '@/shared/ui';

type Look = {
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  background: keyof ColorTokens;
};

const looks: Record<ReminderStatusView['kind'], Look> = {
  active: { icon: 'bell', color: 'success', background: 'successSoft' },
  none: { icon: 'bell', color: 'primary', background: 'primarySoft' },
  pending: { icon: 'clock', color: 'primary', background: 'primarySoft' },
  paused: { icon: 'pause-circle', color: 'warning', background: 'warningSoft' },
  undetermined: { icon: 'bell-off', color: 'warning', background: 'warningSoft' },
  denied: { icon: 'bell-off', color: 'danger', background: 'dangerSoft' },
};

/**
 * Ligne d'état des rappels (Réglages › Notifications) : combien sont programmés et jusqu'à
 * quand (dernier passage réussi du planificateur), ou pourquoi ils ne sonneront pas.
 */
export function ReminderStatusCard({ prefs }: { prefs: NotificationPreferences }) {
  const { t, i18n } = useTranslation();
  const { spacing } = useTheme();
  const spaces = useSpaces();
  const permission = useNotificationPermission();
  const status = useLiveQuery(getReminderRunStatus, [settingTable(REMINDER_STATUS_KEY)], []);
  const paused = remindersPaused(prefs, {
    study: spaces.has('study'),
    personal: spaces.has('personal'),
  });
  const view = reminderStatusView({
    permission: permission.state,
    paused,
    status: status.data ?? null,
  });
  if (!view) return null;
  const look = looks[view.kind];

  let title: string;
  let hint: string | null = null;
  switch (view.kind) {
    case 'active':
      title = t('settings.reminderStatus.active', {
        count: view.count,
        date: formatDayMonth(view.until, i18n.language),
      });
      hint = status.data?.safetyNetAt
        ? t('settings.reminderStatus.activeHint', {
            date: formatDayMonth(new Date(status.data.safetyNetAt), i18n.language),
          })
        : t('settings.reminderStatus.activeHintNoNet');
      break;
    case 'none':
      title = t('settings.reminderStatus.none');
      break;
    case 'pending':
      title = t('settings.reminderStatus.pending');
      break;
    case 'paused':
      title = t('settings.reminderStatus.paused');
      hint = t('settings.reminderStatus.pausedHint');
      break;
    case 'undetermined':
      title = t('settings.reminderStatus.undetermined');
      break;
    case 'denied':
      title = t('settings.reminderStatus.denied');
      hint = t('settings.reminderStatus.deniedHint');
      break;
  }
  const ranAt =
    (view.kind === 'active' || view.kind === 'none') && status.data
      ? t('settings.reminderStatus.updatedAt', {
          date: formatDateTime(new Date(status.data.ranAt), i18n.language),
        })
      : null;

  return (
    <Card>
      <View style={{ gap: spacing.md }} testID={`reminder-status-${view.kind}`}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <IconBadge icon={look.icon} color={look.color} background={look.background} />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong" accessibilityRole="header">
              {title}
            </AppText>
            {hint ? (
              <AppText variant="caption" color="muted">
                {hint}
              </AppText>
            ) : null}
            {ranAt ? (
              <AppText variant="caption" color="muted">
                {ranAt}
              </AppText>
            ) : null}
          </View>
        </View>
        {view.kind === 'undetermined' ? (
          <Button
            label={t('settings.allow')}
            onPress={() => void permission.ask({ force: true })}
          />
        ) : null}
        {view.kind === 'denied' ? (
          <TextButton
            label={t('settings.reminderStatus.openSettings')}
            onPress={openNotificationSettings}
          />
        ) : null}
      </View>
    </Card>
  );
}
