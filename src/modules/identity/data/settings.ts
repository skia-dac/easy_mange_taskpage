import { nowIso, notifyChange, type Db } from '@/shared/db';
import { logger } from '@/shared/logger';

import {
  defaultNotificationPreferences,
  languagePreferenceSchema,
  notificationPreferencesSchema,
  type LanguagePreference,
  type NotificationPreferences,
} from '../domain/preferences';

const KEYS = { notifications: 'notifications', language: 'language' } as const;

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
