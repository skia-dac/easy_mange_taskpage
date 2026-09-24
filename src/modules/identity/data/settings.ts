import { nowIso, notifyChange, type Db } from '@/shared/db';
import { logger } from '@/shared/logger';

import {
  appearancePreferenceSchema,
  defaultNotificationPreferences,
  languagePreferenceSchema,
  notificationPreferencesSchema,
  type AppearancePreference,
  type LanguagePreference,
  type NotificationPreferences,
  defaultWeekStart,
  weekStartSchema,
  type WeekStart,
} from '../domain/preferences';

const KEYS = {
  notifications: 'notifications',
  language: 'language',
  appearance: 'appearance',
  weekStart: 'week_start',
  lastBackupAt: 'last_backup_at',
  appLock: 'app_lock',
} as const;

async function readSetting(db: Db, key: string): Promise<unknown> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  );
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as unknown;
  } catch {
    logger.warn('Réglage illisible, valeur par défaut utilisée', { key });
    return undefined;
  }
}

async function writeSetting(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), nowIso()],
  );
  notifyChange(['app_settings']);
}

export async function getNotificationPreferences(db: Db): Promise<NotificationPreferences> {
  const parsed = notificationPreferencesSchema.safeParse(await readSetting(db, KEYS.notifications));
  return parsed.success ? parsed.data : defaultNotificationPreferences;
}

export async function setNotificationPreferences(
  db: Db,
  prefs: NotificationPreferences,
): Promise<void> {
  await writeSetting(db, KEYS.notifications, notificationPreferencesSchema.parse(prefs));
}

export async function getLanguagePreference(db: Db): Promise<LanguagePreference> {
  const parsed = languagePreferenceSchema.safeParse(await readSetting(db, KEYS.language));
  return parsed.success ? parsed.data : 'auto';
}

export async function setLanguagePreference(db: Db, value: LanguagePreference): Promise<void> {
  await writeSetting(db, KEYS.language, value);
}

const ONBOARDING_KEY = 'onboarding_done';

export async function isOnboardingDone(db: Db): Promise<boolean> {
  return (await readSetting(db, ONBOARDING_KEY)) === true;
}

export async function setOnboardingDone(db: Db): Promise<void> {
  await writeSetting(db, ONBOARDING_KEY, true);
}

export async function getAppearancePreference(db: Db): Promise<AppearancePreference> {
  const parsed = appearancePreferenceSchema.safeParse(await readSetting(db, KEYS.appearance));
  return parsed.success ? parsed.data : 'auto';
}

export async function setAppearancePreference(db: Db, value: AppearancePreference): Promise<void> {
  await writeSetting(db, KEYS.appearance, value);
}

export async function getWeekStart(db: Db): Promise<WeekStart> {
  const parsed = weekStartSchema.safeParse(await readSetting(db, KEYS.weekStart));
  return parsed.success ? parsed.data : defaultWeekStart;
}

export async function setWeekStart(db: Db, value: WeekStart): Promise<void> {
  await writeSetting(db, KEYS.weekStart, weekStartSchema.parse(value));
}

/** Date (ISO) de la dernière sauvegarde automatique, ou null. */
export async function getLastBackupAt(db: Db): Promise<string | null> {
  const value = await readSetting(db, KEYS.lastBackupAt);
  return typeof value === 'string' ? value : null;
}

export async function setLastBackupAt(db: Db, isoDate: string): Promise<void> {
  await writeSetting(db, KEYS.lastBackupAt, isoDate);
}

/** Verrouillage de l'app par Face ID / Touch ID / code du téléphone. */
export async function isAppLockEnabled(db: Db): Promise<boolean> {
  return (await readSetting(db, KEYS.appLock)) === true;
}

export async function setAppLockEnabled(db: Db, value: boolean): Promise<void> {
  await writeSetting(db, KEYS.appLock, value);
}
