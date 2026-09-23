import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, Switch, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import {
  courseReminderOptions,
  getAppearancePreference,
  getLanguagePreference,
  setAppearancePreference,
  getNotificationPreferences,
  setLanguagePreference,
  setNotificationPreferences,
  type AppearancePreference,
  type LanguagePreference,
  type NotificationPreferences,
} from '@/modules/identity';
import { ensurePermission, hasPermission } from '@/modules/platform';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { detectLanguage, i18n } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  SectionHeader,
  Segmented,
  showError,
  TextButton,
} from '@/shared/ui';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [lang, setLang] = useState<LanguagePreference>('auto');
  const [appearance, setAppearance] = useState<AppearancePreference>('auto');
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      getNotificationPreferences(db),
      getLanguagePreference(db),
      getAppearancePreference(db),
      hasPermission(),
    ]).then(([p, l, a, g]) => {
      setPrefs(p);
      setLang(l);
      setAppearance(a);
      setGranted(g);
    });
  }, [db]);

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

  if (!prefs) return null;

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
    </ScrollView>
  );
}
