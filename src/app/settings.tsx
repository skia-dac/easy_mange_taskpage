import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Switch, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import {
  courseReminderOptions,
  getAppearancePreference,
  getLanguagePreference,
  getLastBackupAt,
  getNotificationPreferences,
  getWeekStart,
  setAppearancePreference,
  setLanguagePreference,
  setNotificationPreferences,
  setWeekStart,
  weekStartOptions,
  type AppearancePreference,
  type LanguagePreference,
  type NotificationPreferences,
  type WeekStart,
} from '@/modules/identity';
import {
  ensurePermission,
  hasPermission,
  listBackups,
  pickBackupFile,
  readBackup,
  restoreBackup,
  shareBackup,
  snapshotSummary,
  writeBackup,
  type BackupFile,
  type BackupSnapshot,
} from '@/modules/platform';
import { useDb } from '@/shared/db';
import { AppError, userMessageKey } from '@/shared/errors';
import { formatDateTime } from '@/shared/format';
import { detectLanguage, i18n } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  ChoiceSheet,
  confirmDestructive,
  LoadingScreen,
  SectionHeader,
  Segmented,
  showError,
  showInfo,
  TextButton,
} from '@/shared/ui';
import { wipeAllData } from '@/workflows';

type SheetKind = 'share' | 'restore' | null;

function backupErrorKey(e: unknown): string {
  if (e instanceof AppError && e.message === 'backupUnreadable') return 'backup.unreadable';
  if (e instanceof AppError && e.message === 'backupTooRecent') return 'backup.tooRecent';
  return userMessageKey(e);
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [lang, setLang] = useState<LanguagePreference>('auto');
  const [appearance, setAppearance] = useState<AppearancePreference>('auto');
  const [weekStart, setWeekStartState] = useState<WeekStart>(1);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [busy, setBusy] = useState(false);

  const refreshBackups = useCallback(async () => {
    const last = await getLastBackupAt(db);
    setLastBackup(last);
    setBackups(listBackups());
  }, [db]);

  useEffect(() => {
    void Promise.all([
      getNotificationPreferences(db),
      getLanguagePreference(db),
      getAppearancePreference(db),
      getWeekStart(db),
      hasPermission(),
    ]).then(([p, l, a, w, g]) => {
      setPrefs(p);
      setLang(l);
      setAppearance(a);
      setWeekStartState(w);
      setGranted(g);
      void refreshBackups();
    });
  }, [db, refreshBackups]);

  const update = (patch: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setNotificationPreferences(db, next).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const allow = async () => {
    const ok = await ensurePermission();
    setGranted(ok);
    if (!ok) await Linking.openSettings();
  };

  const changeLanguage = (value: LanguagePreference) => {
    setLang(value);
    void i18n.changeLanguage(value === 'auto' ? detectLanguage() : value);
    setLanguagePreference(db, value).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const run = async (
    job: () => Promise<void>,
    errorKey: (e: unknown) => string = userMessageKey,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      showError(errorKey(e));
    } finally {
      setBusy(false);
      await refreshBackups();
    }
  };

  const backupNow = () =>
    run(async () => {
      await writeBackup(db);
      showInfo(t('backup.doneTitle'), t('backup.doneMessage'));
    });

  const share = (file: BackupFile) =>
    run(async () => {
      if (!(await shareBackup(file.uri))) showError('backup.shareUnavailable');
    });

  const restore = (uri: string) =>
    run(async () => {
      const snapshot: BackupSnapshot = await readBackup(db, uri);
      const { items } = snapshotSummary(snapshot);
      const ok = await confirmDestructive(
        t('backup.restoreTitle'),
        t('backup.restoreMessage', {
          count: items,
          date: formatDateTime(new Date(snapshot.createdAt), labels.lang),
        }),
        t('backup.restoreConfirm'),
      );
      if (!ok) return;
      await restoreBackup(db, snapshot);
      showInfo(t('backup.restoredTitle'), t('backup.restoredMessage'));
    }, backupErrorKey);

  const restoreFromPicker = () =>
    run(async () => {
      const uri = await pickBackupFile();
      if (uri) await restore(uri);
    });

  const wipe = () =>
    run(async () => {
      const first = await confirmDestructive(
        t('data.wipeTitle'),
        t('data.wipeMessage'),
        t('data.wipeConfirm'),
      );
      if (!first) return;
      const second = await confirmDestructive(
        t('data.wipeAgainTitle'),
        t('data.wipeAgainMessage'),
        t('data.wipeAgainConfirm'),
      );
      if (!second) return;
      await wipeAllData(db);
      router.replace('/onboarding');
    });

  const toggle = (label: string, key: keyof NotificationPreferences, hint?: string) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={prefs?.[key] === true}
        onValueChange={(v) => update({ [key]: v })}
        trackColor={{ true: colors.success, false: colors.border }}
      />
    </View>
  );

  if (!prefs) return <LoadingScreen />;

  const backupOptions = (onPick: (file: BackupFile) => void) =>
    backups.map((b) => ({
      label: formatDateTime(new Date(b.createdAt), labels.lang),
      hint:
        b.size === null
          ? undefined
          : t('backup.size', { kb: Math.max(1, Math.round(b.size / 1024)) }),
      onPress: () => onPick(b),
    }));

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <SectionHeader title={t('settings.notifications')} />
      {granted === false ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <AppText>{t('settings.permissionOff')}</AppText>
            <Button label={t('settings.allow')} onPress={() => void allow()} />
            <TextButton
              label={t('settings.openSettings')}
              onPress={() => void Linking.openSettings()}
            />
          </View>
        </Card>
      ) : null}
      <Card>
        {toggle(t('settings.courses'), 'courses')}
        {prefs.courses ? (
          <ChoiceChips
            label={t('settings.courseMinutes')}
            options={courseReminderOptions.map((m) => ({
              value: m,
              label: labels.reminderMinutes(m),
            }))}
            selected={[prefs.courseReminderMinutes]}
            onToggle={(courseReminderMinutes) => update({ courseReminderMinutes })}
          />
        ) : null}
        {toggle(t('settings.endOfCourse'), 'endOfCourse', t('settings.endOfCourseHint'))}
        {toggle(t('settings.assignments'), 'assignments')}
        {toggle(t('settings.tasks'), 'tasks')}
        {toggle(t('settings.exams'), 'exams')}
        {toggle(t('settings.events'), 'events')}
      </Card>
      <Card>
        {toggle(t('settings.sound'), 'sound', t('settings.soundHint'))}
        {toggle(t('settings.vibrate'), 'vibrate', t('settings.vibrateHint'))}
      </Card>

      <SectionHeader title={t('settings.week')} />
      <Segmented
        accessibilityLabel={t('settings.weekStart')}
        value={String(weekStart)}
        onChange={(v) => {
          const next = Number(v) as WeekStart;
          setWeekStartState(next);
          setWeekStart(db, next).catch((e: unknown) => showError(userMessageKey(e)));
        }}
        options={weekStartOptions.map((d) => ({ value: String(d), label: labels.weekday(d) }))}
      />
      <AppText variant="caption" color="muted">
        {t('settings.weekStartHint')}
      </AppText>

      <SectionHeader title={t('settings.appearance')} />
      <Segmented
        value={appearance}
        onChange={(v) => {
          setAppearance(v);
          setAppearancePreference(db, v).catch((e: unknown) => showError(userMessageKey(e)));
        }}
        options={[
          { value: 'auto', label: t('settings.appAuto') },
          { value: 'light', label: t('settings.appLight') },
          { value: 'dark', label: t('settings.appDark') },
        ]}
      />

      <SectionHeader title={t('settings.language')} />
      <Segmented
        value={lang}
        onChange={changeLanguage}
        options={[
          { value: 'auto', label: t('settings.langAuto') },
          { value: 'fr', label: t('settings.langFr') },
          { value: 'en', label: t('settings.langEn') },
        ]}
      />

      <SectionHeader title={t('data.title')} />
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="bodyStrong">{t('backup.title')}</AppText>
            <AppText variant="caption" color="muted">
              {lastBackup
                ? t('backup.last', { date: formatDateTime(new Date(lastBackup), labels.lang) })
                : t('backup.never')}
            </AppText>
            <AppText variant="caption" color="muted">
              {t('backup.hint')}
            </AppText>
          </View>
          <Button label={t('backup.now')} onPress={() => void backupNow()} disabled={busy} />
          {backups.length > 0 ? (
            <TextButton label={t('backup.share')} onPress={() => setSheet('share')} />
          ) : null}
          <TextButton label={t('backup.restore')} onPress={() => setSheet('restore')} />
        </View>
      </Card>
      <Card>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong">{t('data.wipe')}</AppText>
          <AppText variant="caption" color="muted">
            {t('data.wipeHint')}
          </AppText>
          <TextButton label={t('data.wipe')} color="danger" onPress={() => void wipe()} />
        </View>
      </Card>

      <ChoiceSheet
        visible={sheet === 'share'}
        title={t('backup.share')}
        message={t('backup.shareMessage')}
        options={backupOptions((b) => void share(b))}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'restore'}
        title={t('backup.restore')}
        message={t('backup.restoreHint')}
        options={[
          ...backupOptions((b) => void restore(b.uri)),
          { label: t('backup.chooseFile'), onPress: () => void restoreFromPicker() },
        ]}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}
