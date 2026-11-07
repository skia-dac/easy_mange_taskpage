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

/**
 * Nettoyages à faire juste AVANT une migration déjà publiée (clé = sa version), dans la même
 * transaction. Une migration publiée ne se modifie jamais ; si son SQL peut échouer sur certaines
 * données (ex. un index unique sur des doublons), on prépare les données ici, en code.
 */
export type MigrationPreparations = Readonly<Partial<Record<number, string>>>;

export function validateMigrations(
  migrations: readonly Migration[],
  preparations: MigrationPreparations = {},
): void {
  migrations.forEach((m, index) => {
    if (m.version !== index + 1) {
      throw new Error(`Migration "${m.name}" : version ${m.version}, attendue ${index + 1}.`);
    }
  });
  for (const key of Object.keys(preparations)) {
    const version = Number(key);
    if (!Number.isInteger(version) || version < 1 || version > migrations.length)
      throw new Error(`Préparation pour une migration inconnue : ${key}.`);
  }
}

/**
 * Met la base locale à jour en appliquant, dans l'ordre, les migrations pas encore faites.
 * Chaque migration est dans sa propre transaction (avec sa préparation éventuelle) : si elle
 * échoue, rien n'est à moitié appliqué.
 * @returns la version de la base après migration
 */
export async function migrate(
  db: MigratableDatabase,
  migrations: readonly Migration[],
  preparations: MigrationPreparations = {},
): Promise<number> {
  validateMigrations(migrations, preparations);
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;
  const latest = migrations.length;

  if (current > latest) {
    // La base vient d'une version plus récente de l'app : on ne touche à rien pour ne rien perdre.
    throw new AppError('unknown', `Base locale en version ${current}, app en version ${latest}.`);
  }

  for (const migration of migrations.slice(current)) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const before = preparations[migration.version];
      if (before) await txn.execAsync(before);
      await txn.execAsync(migration.sql);
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return latest;
}
