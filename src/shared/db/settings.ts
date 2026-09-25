import { logger } from '../logger';
import { notifyChange } from './changes';
import { nowIso } from './ids';
import type { Db } from './types';

/** Réglage local (table app_settings), en JSON. undefined = absent ou illisible. */
export async function readAppSetting(db: Db, key: string): Promise<unknown> {
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

/** `silent` : n'avertit pas les écrans (données techniques de synchronisation, écrites souvent). */
export async function writeAppSetting(
  db: Db,
  key: string,
  value: unknown,
  silent = false,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), nowIso()],
  );
  if (!silent) notifyChange(['app_settings']);
}
