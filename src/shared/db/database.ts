import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from './migrate';
import { migrations } from './migrations';

export const DATABASE_NAME = 'mysky.db';

/**
 * Appelé une fois à l'ouverture de la base (SQLiteProvider onInit).
 * Rappel sécurité : toujours passer les valeurs en paramètres
 * (db.runAsync('… WHERE id = ?', [id])), jamais par concaténation de texte.
 */
export async function setupDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db, migrations);
}
