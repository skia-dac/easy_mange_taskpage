// Vérifie que le schéma serveur (supabase/migrations) s'exécute sur un vrai Postgres (PGlite)
// et que mysky_push et la sécurité par ligne se comportent comme prévu.
// Supabase fournit les schémas auth et storage : on en crée ici une version minimale.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const sql = readFileSync(
  new URL('../supabase/migrations/20260924000000_mysky.sql', import.meta.url),
  'utf8',
);
const db = new PGlite();
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/') $$;
  grant usage on schema public, auth, storage to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${A}'), ('${B}');
`);
await db.exec(sql);

let failures = 0;
const check = (label, ok, extra) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ' ' + JSON.stringify(extra)}`);
  if (!ok) failures++;
};

// Projet créé avec une version plus ancienne du fichier : le relancer ajoute ce qui manque.
await db.exec('alter table public.tasks drop column estimated_minutes;');
await db.exec(sql);
const upgraded = await db.query(
  `select 1 from information_schema.columns
   where table_schema = 'public' and table_name = 'tasks' and column_name = 'estimated_minutes'`,
);
check('relancer le fichier met à jour un projet existant', upgraded.rows.length === 1);
async function as(user, fn) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}
const push = (user, mutations) =>
  as(
    user,
    async () =>
      (await db.query('select public.mysky_push($1::jsonb) as r', [JSON.stringify(mutations)]))
        .rows[0].r,
  );

const create = {
  mutation_id: 'm1',
  entity: 'subjects',
  entity_id: 's1',
  operation: 'create',
  base_version: null,
  payload: {
    id: 's1',
    name: 'Maths',
    color_id: 'blue',
    created_at: '2026-09-24T08:00:00.000Z',
    updated_at: '2026-09-24T08:00:00.000Z',
  },
};
let r = await push(A, [create]);
check('create appliqué en version 1', r[0].status === 'applied' && r[0].version === 1, r);
r = await push(A, [create]);
check(
  'même modification renvoyée : comptée une fois',
  r[0].status === 'applied' && r[0].version === 1,
  r,
);

r = await push(A, [
  { ...create, mutation_id: 'm1bis', payload: { ...create.payload, name: 'Copie' } },
]);
check(
  'create d’une ligne déjà présente → conflit avec la ligne du serveur',
  r[0].status === 'conflict' && r[0].server?.name === 'Maths' && r[0].server?.version === 1,
  r,
);

r = await push(A, [
  {
    mutation_id: 'm2',
    entity: 'subjects',
    entity_id: 's1',
    operation: 'update',
    base_version: 1,
    payload: { name: 'Mathématiques', updated_at: '2026-09-24T09:00:00.000Z', inconnue: 1 },
  },
]);
check(
  'update avec la bonne version → version 2',
  r[0].status === 'applied' && r[0].version === 2,
  r,
);

r = await push(A, [
  {
    mutation_id: 'm3',
    entity: 'subjects',
    entity_id: 's1',
    operation: 'update',
    base_version: 1,
    payload: { name: 'Autre', updated_at: '2026-09-24T09:30:00.000Z' },
  },
]);
check(
  'update avec une version ancienne → conflit avec la ligne du serveur',
  r[0].status === 'conflict' &&
    r[0].server.name === 'Mathématiques' &&
    r[0].server.version === 2 &&
    !('user_id' in r[0].server),
  r,
);

r = await push(A, [
  {
    mutation_id: 'm4',
    entity: 'subjects',
    entity_id: 'nope',
    operation: 'update',
    base_version: 1,
    payload: { name: 'x' },
  },
]);
check('update d’une ligne absente → missing', r[0].status === 'missing', r);

r = await push(A, [
  {
    mutation_id: 'm5',
    entity: 'subjects',
    entity_id: 's1',
    operation: 'delete',
    base_version: 2,
    payload: { deleted_at: '2026-09-24T10:00:00.000Z', updated_at: '2026-09-24T10:00:00.000Z' },
  },
]);
check('suppression logique → version 3', r[0].status === 'applied' && r[0].version === 3, r);

const rowsA = await as(
  A,
  async () => (await db.query('select id, name, deleted_at, version from public.subjects')).rows,
);
check('A voit sa ligne', rowsA.length === 1 && rowsA[0].deleted_at !== null, rowsA);
const rowsB = await as(B, async () => (await db.query('select id from public.subjects')).rows);
check('B ne voit pas les lignes de A (RLS)', rowsB.length === 0, rowsB);

r = await push(B, [
  {
    mutation_id: 'b1',
    entity: 'subjects',
    entity_id: 's1',
    operation: 'update',
    base_version: 3,
    payload: { name: 'piratage' },
  },
]);
check('B ne peut pas modifier la ligne de A', r[0].status === 'missing', r);

let refused = false;
try {
  await push(B, [
    {
      mutation_id: 'b2',
      entity: 'sync_mutations',
      entity_id: 'x',
      operation: 'create',
      payload: {},
    },
  ]);
} catch {
  refused = true;
}
check('table non autorisée refusée', refused);

refused = false;
try {
  await db.exec('set role anon;');
  await db.query("select public.mysky_push('[]'::jsonb)");
} catch {
  refused = true;
} finally {
  await db.exec('reset role;');
}
check('utilisateur non connecté refusé', refused);

const cursor = await as(
  A,
  async () => (await db.query('select server_updated_at from public.subjects')).rows[0],
);
check(
  'server_updated_at posé par le serveur',
  cursor && cursor.server_updated_at instanceof Date,
  cursor,
);

await db.exec(`delete from auth.users where id = '${A}'`);
const left = (await db.query('select count(*)::int as n from public.subjects')).rows[0].n;
check('supprimer le compte supprime ses lignes', left === 0, left);

await db.close();
if (failures > 0) {
  console.error(`${failures} échec(s)`);
  process.exit(1);
}
console.log('Schéma serveur vérifié.');
