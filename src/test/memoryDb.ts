import Database from 'better-sqlite3';

import { migrate, migrations, type Db, type SqlValue } from '@/shared/db';

/** Vraie base SQLite en mémoire, avec la même interface que sur le téléphone. Tests uniquement. */
export async function createTestDb(): Promise<Db & { close(): void }> {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db: Db & { close(): void } = {
    async execAsync(source) {
      sqlite.exec(source);
    },
    async runAsync(source, params: SqlValue[]) {
      return sqlite.prepare(source).run(...params);
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return (sqlite.prepare(source).get(...params) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return sqlite.prepare(source).all(...params) as T[];
    },
    async withExclusiveTransactionAsync(task) {
      sqlite.exec('BEGIN EXCLUSIVE');
      try {
        await task(db);
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
    close() {
      sqlite.close();
    },
  };
  await migrate(db, migrations);
  return db;
}
