/** Valeurs acceptées dans une requête SQL paramétrée. */
export type SqlValue = string | number | null;

/**
 * Le sous-ensemble de la base SQLite utilisé par l'app.
 * `SQLiteDatabase` d'expo-sqlite le respecte ; les tests utilisent une vraie base SQLite en mémoire.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<unknown>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withExclusiveTransactionAsync(task: (txn: Db) => Promise<void>): Promise<void>;
}
