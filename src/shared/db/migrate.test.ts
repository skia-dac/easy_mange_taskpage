import { AppError } from '../errors';
import { migrate, validateMigrations, type MigratableDatabase, type Migration } from './migrate';
import { migrations } from './migrations';

function fakeDb(startVersion = 0, failOn?: string) {
  const state = { version: startVersion, executed: [] as string[] };
  const db: MigratableDatabase = {
    async execAsync(sql) {
      if (failOn && sql.includes(failOn)) throw new Error('SQL error');
      const m = /PRAGMA user_version = (\d+)/.exec(sql);
      if (m) state.version = Number(m[1]);
      else state.executed.push(sql.trim());
    },
    async getFirstAsync<T>(_sql: string, _params: unknown[]) {
      return { user_version: state.version } as T;
    },
    async withExclusiveTransactionAsync(task) {
      const snapshot = { version: state.version, executed: [...state.executed] };
      try {
        await task(db);
      } catch (e) {
        Object.assign(state, snapshot); // rollback
        throw e;
      }
    },
  };
  return { db, state };
}

const sample: Migration[] = [
  { version: 1, name: 'a', sql: 'CREATE TABLE a (x)' },
  { version: 2, name: 'b', sql: 'CREATE TABLE b (x)' },
];

describe('migrate', () => {
  it('applique toutes les migrations sur une base neuve', async () => {
    const { db, state } = fakeDb();
    await expect(migrate(db, sample)).resolves.toBe(2);
    expect(state.version).toBe(2);
    expect(state.executed).toEqual(['CREATE TABLE a (x)', 'CREATE TABLE b (x)']);
  });

  it('n’applique que les migrations manquantes', async () => {
    const { db, state } = fakeDb(1);
    await migrate(db, sample);
    expect(state.executed).toEqual(['CREATE TABLE b (x)']);
  });

  it('ne fait rien si la base est à jour (relancer est sans danger)', async () => {
    const { db, state } = fakeDb(2);
    await migrate(db, sample);
    expect(state.executed).toEqual([]);
  });

  it('s’arrête sans avancer la version si une migration échoue', async () => {
    const { db, state } = fakeDb(0, 'TABLE b');
    await expect(migrate(db, sample)).rejects.toThrow('SQL error');
    expect(state.version).toBe(1);
  });

  it('refuse une base plus récente que l’app, sans rien modifier', async () => {
    const { db, state } = fakeDb(5);
    await expect(migrate(db, sample)).rejects.toBeInstanceOf(AppError);
    expect(state.executed).toEqual([]);
  });
});

describe('liste des migrations de l’app', () => {
  it('a des numéros qui se suivent', () => {
    expect(() => validateMigrations(migrations)).not.toThrow();
  });

  it('détecte un numéro manquant', () => {
    expect(() => validateMigrations([sample[1]!])).toThrow();
  });
});
