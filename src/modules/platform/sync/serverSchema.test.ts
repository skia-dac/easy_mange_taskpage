import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { SYNCED_TABLES } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import { generateServerSql } from './serverSchema';

const FILE = join(__dirname, '../../../../supabase/migrations/20260924000000_mysky.sql');

describe('schéma du serveur', () => {
  it('correspond au schéma du téléphone (sinon : UPDATE_SERVER_SCHEMA=1 npx jest serverSchema)', async () => {
    const db = await createTestDb();
    const sql = await generateServerSql(db);
    db.close();
    if (process.env.UPDATE_SERVER_SCHEMA === '1') writeFileSync(FILE, sql);
    expect(readFileSync(FILE, 'utf8')).toBe(sql);
  });

  it('protège chaque table par la sécurité par ligne et ne garde pas sync_status', async () => {
    const db = await createTestDb();
    const sql = await generateServerSql(db);
    db.close();
    for (const t of SYNCED_TABLES) {
      expect(sql).toContain(`alter table public.${t} enable row level security;`);
      expect(sql).toContain(`create policy "own rows" on public.${t}`);
    }
    expect(sql).not.toMatch(/sync_status text/);
    expect(sql).toContain('(storage.foldername(name))[1] = auth.uid()::text');
  });
});
