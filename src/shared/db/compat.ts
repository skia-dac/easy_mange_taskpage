import type { SQLiteDatabase } from 'expo-sqlite';

import type { MigratableDatabase } from './migrate';
import type { Db } from './types';

// Vérification à la compilation : la vraie base du téléphone respecte nos interfaces.
// Si expo-sqlite change son API, TypeScript refusera de compiler ce fichier.
export function asDb(db: SQLiteDatabase): Db & MigratableDatabase {
  return db;
}
