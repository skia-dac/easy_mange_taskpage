import { AppError } from '../errors';
import type { Db } from './types';

export type Migration = {
  /** 1, 2, 3… : chaque migration a un numéro unique, dans l'ordre. */
  version: number;
  name: string;
  sql: string;
};

/** Le minimum dont le moteur de migrations a besoin (compatible avec SQLiteDatabase). */
export type MigratableDatabase = Pick<Db, 'execAsync' | 'getFirstAsync'> & {
  withExclusiveTransactionAsync(task: (txn: MigratableDatabase) => Promise<void>): Promise<void>;
};

export function validateMigrations(migrations: readonly Migration[]): void {
  migrations.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new Error(`Migration "${m.name}" : version ${m.version}, attendue ${index + 1}.`);
    }
  });
}

/**
 * Met la base locale à jour en appliquant, dans l'ordre, les migrations pas encore faites.
 * Chaque migration est dans sa propre transaction : si elle échoue, rien n'est à moitié appliqué.
 * @returns la version de la base après migration
 */
export async function migrate(
  db: MigratableDatabase,
  migrations: readonly Migration[],
): Promise<number> {
  validateMigrations(migrations);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  const latest = migrations.length;

  if (current > latest) {
    // La base vient d'une version plus récente de l'app : on ne touche à rien pour ne rien perdre.
    throw new AppError('unknown', `Base locale en version ${current}, app en version ${latest}.`);
  }

  for (const migration of migrations.slice(current)) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(migration.sql);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return latest;
}
