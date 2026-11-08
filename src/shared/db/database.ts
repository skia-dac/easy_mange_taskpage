import type { SQLiteDatabase } from 'expo-sqlite';

import { asDb } from './compat';
import { migrate } from './migrate';
import { migrationPreparations, migrations } from './migrations';
import { repairDivergentSchema } from './repair';

export const DATABASE_NAME = 'mysky.db';

/**
 * Appelé une fois à l'ouverture de la base (SQLiteProvider onInit).
 * Rappel sécurité : toujours passer les valeurs en paramètres
 * (db.runAsync('… WHERE id = ?', [id])), jamais par concaténation de texte.
 */
export async function setupDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  // Une base de développement peut annoncer une version sans en avoir les colonnes : on répare
  // d'abord ce qui manque, puis on migre normalement.
  await repairDivergentSchema(asDb(db));
  await migrate(asDb(db), migrations, migrationPreparations);
}
