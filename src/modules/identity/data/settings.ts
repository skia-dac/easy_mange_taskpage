import { readAppSetting, writeAppSetting, type Db } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { normalizeSpaces, type ActiveSpaces, type SpaceId } from '@/shared/spaces';

import {
  appearancePreferenceSchema,
  defaultNotificationPreferences,
  languagePreferenceSchema,
  notificationPreferencesSchema,
  type AppearancePreference,
  type LanguagePreference,
  type NotificationPreferences,
  accentPreferenceSchema,
  normalizeTodayLayout,
  textScalePreferenceSchema,
  todayLayoutSchema,
  type TodayLayout,
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

const readSetting = readAppSetting;
const writeSetting = writeAppSetting;

async function deleteSetting(db: Db, key: string): Promise<void> {
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', [key]);
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

/** Compte auquel appartiennent les données de ce téléphone (id Supabase), ou null. */
export async function getAccountOwner(db: Db): Promise<string | null> {
  const v = await readSetting(db, 'account_owner');
  return typeof v === 'string' ? v : null;
}

export async function setAccountOwner(db: Db, userId: string | null): Promise<void> {
  if (userId) await writeSetting(db, 'account_owner', userId);
  else await deleteSetting(db, 'account_owner');
}

/** Curseur de synchronisation d'une table : dernière date serveur reçue. */
export async function getSyncCursor(db: Db, table: string): Promise<string | null> {
  const v = await readSetting(db, `sync_cursor:${table}`);
  return typeof v === 'string' ? v : null;
}

export async function setSyncCursor(db: Db, table: string, cursor: string): Promise<void> {
  await writeSetting(db, `sync_cursor:${table}`, cursor, true);
}

/** Efface tous les curseurs (prochaine synchronisation = tout recevoir à nouveau). */
export async function clearSyncCursors(db: Db): Promise<void> {
  await db.runAsync("DELETE FROM app_settings WHERE key LIKE 'sync_cursor:%'", []);
}

export async function getLastSyncAt(db: Db): Promise<string | null> {
  const v = await readSetting(db, 'last_sync_at');
  return typeof v === 'string' ? v : null;
}

export async function setLastSyncAt(db: Db, iso: string): Promise<void> {
  await writeSetting(db, 'last_sync_at', iso);
}

export type AccentPreference = 'blue' | 'violet' | 'teal' | 'green' | 'rose' | 'orange';
export type TextScalePreference = 'small' | 'normal' | 'large' | 'xlarge';

export async function getAccentPreference(db: Db): Promise<AccentPreference> {
  const parsed = accentPreferenceSchema.safeParse(await readSetting(db, 'accent'));
  return parsed.success ? parsed.data : 'blue';
}

export async function setAccentPreference(db: Db, value: AccentPreference): Promise<void> {
  await writeSetting(db, 'accent', accentPreferenceSchema.parse(value));
}

export async function getTextScalePreference(db: Db): Promise<TextScalePreference> {
  const parsed = textScalePreferenceSchema.safeParse(await readSetting(db, 'text_scale'));
  return parsed.success ? parsed.data : 'normal';
}

export async function setTextScalePreference(db: Db, value: TextScalePreference): Promise<void> {
  await writeSetting(db, 'text_scale', textScalePreferenceSchema.parse(value));
}

export async function getTodayLayout(db: Db): Promise<TodayLayout> {
  const parsed = todayLayoutSchema.safeParse(await readSetting(db, 'today_layout'));
  return normalizeTodayLayout(parsed.success ? parsed.data : null);
}

export async function setTodayLayout(db: Db, layout: TodayLayout): Promise<void> {
  await writeSetting(db, 'today_layout', normalizeTodayLayout(todayLayoutSchema.parse(layout)));
}

/**
 * Espaces actifs (Études / Pro / Perso). Jamais vide : une installation d'avant les espaces
 * garde Études + Perso (tout ce qu'elle voyait).
 */
export async function getActiveSpaces(db: Db): Promise<ActiveSpaces> {
  return normalizeSpaces(await readSetting(db, 'spaces'));
}

/** Enregistre les espaces ; une liste vide est refusée (au moins un espace reste actif). */
export async function setActiveSpaces(db: Db, spaces: readonly SpaceId[]): Promise<void> {
  const clean = normalizeSpaces(spaces, []);
  if (clean.length === 0) throw new AppError('validation');
  await writeSetting(db, 'spaces', clean);
}

/** Heures de travail visées par semaine (espace Pro, tuile « À planifier »). */
export const DEFAULT_WORK_WEEK_HOURS = 40;
export const workWeekHourChoices = [10, 15, 20, 25, 30, 35, 38, 40, 45, 50, 60] as const;

export async function getWorkWeekHours(db: Db): Promise<number> {
  const v = await readSetting(db, 'work_week_hours');
  return typeof v === 'number' && v >= 1 && v <= 100 ? v : DEFAULT_WORK_WEEK_HOURS;
}

export async function setWorkWeekHours(db: Db, hours: number): Promise<void> {
  if (!Number.isFinite(hours) || hours < 1 || hours > 100) throw new AppError('validation');
  await writeSetting(db, 'work_week_hours', Math.round(hours));
}

/** Habitude suivie par le widget « Progression » (null = toutes les habitudes). */
export async function getProgressWidgetHabit(db: Db): Promise<string | null> {
  const v = await readSetting(db, 'progress_widget_habit');
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function setProgressWidgetHabit(db: Db, habitId: string | null): Promise<void> {
  await writeSetting(db, 'progress_widget_habit', habitId ?? '');
}
