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
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
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

// Projet créé avec une version plus ancienne du fichier : le relancer ajoute ce qui manque
// (colonne, clé composée de sync_mutations, limite de taille du bucket).
await db.exec('alter table public.tasks drop column estimated_minutes;');
await db.exec(`
  alter table public.sync_mutations drop constraint sync_mutations_pkey;
  alter table public.sync_mutations drop column created_at;
  alter table public.sync_mutations add primary key (mutation_id);
  update storage.buckets set file_size_limit = null;
`);
await db.exec(sql);
const pkey = await db.query(
  `select a.attname from pg_constraint c join unnest(c.conkey) as k(n) on true
   join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n
   where c.conrelid = 'public.sync_mutations'::regclass and c.contype = 'p' order by a.attname`,
);
check(
  'sync_mutations : clé (user_id, mutation_id) rétablie',
  pkey.rows.map((r) => r.attname).join(',') === 'mutation_id,user_id',
  pkey.rows,
);
const bucket = (
  await db.query("select public, file_size_limit from storage.buckets where id = 'mysky-files'")
).rows[0];
check(
  'bucket privé limité à 25 Mo',
  bucket?.public === false && Number(bucket?.file_size_limit) === 26214400,
  bucket,
);
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
for (const stmt of [
  "insert into public.subjects (id, name, color_id, created_at, updated_at) values ('direct', 'x', 'blue', 'now', 'now')",
  "update public.subjects set name = 'x'",
  'delete from public.subjects',
  "insert into public.sync_mutations (mutation_id, entity, entity_id, result_version) values ('x', 'subjects', 's1', 1)",
]) {
  let denied = false;
  try {
    await as(B, () => db.query(stmt));
  } catch (e) {
    denied = /permission denied/i.test(String(e.message));
  }
  check(`écriture directe refusée : ${stmt.slice(0, 40)}…`, denied);
}

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
r = await push(B, [
  {
    mutation_id: 'm1',
    entity: 'subjects',
    entity_id: 's1',
    operation: 'create',
    base_version: null,
    payload: { ...create.payload, name: 'usurpation' },
  },
]);
check(
  'B réutilisant un identifiant de modification de A ne rejoue pas la sienne',
  r[0].status === 'conflict' || r[0].status === 'rejected',
  r,
);
const unchanged = await as(
  A,
  async () => (await db.query("select name, version from public.subjects where id = 's1'")).rows[0],
);
check(
  'la ligne de A est intacte',
  unchanged?.name === 'Mathématiques' && unchanged?.version === 3,
  unchanged,
);

// Purge des identifiants de modification de plus de 30 jours (au début de chaque envoi).
await db.exec(
  `update public.sync_mutations set created_at = now() - interval '31 days' where mutation_id = 'm1'`,
);
r = await push(A, [create]);
check(
  'identifiant purgé après 30 jours : la modification est réexaminée (ligne présente → conflit)',
  r[0].status === 'conflict',
  r,
);

r = await push(B, [
  {
    mutation_id: 'b2',
    entity: 'sync_mutations',
    entity_id: 'x',
    operation: 'create',
    payload: {},
  },
]);
check('table non autorisée → rejected', r[0].status === 'rejected', r);

// Une modification invalide est rejetée seule : celles qui l'entourent sont appliquées.
r = await push(A, [
  {
    mutation_id: 'r1',
    entity: 'subjects',
    entity_id: 's-ok1',
    operation: 'create',
    base_version: null,
    payload: { ...create.payload, id: 's-ok1', name: 'Avant' },
  },
  {
    mutation_id: 'r2',
    entity: 'subjects',
    entity_id: 's-bad',
    operation: 'create',
    base_version: null,
    payload: { ...create.payload, id: 's-bad', name: null },
  },
  {
    mutation_id: 'r3',
    entity: 'subjects',
    entity_id: 's-ok2',
    operation: 'create',
    base_version: null,
    payload: { ...create.payload, id: 's-ok2', name: 'Après' },
  },
]);
check(
  'not null violé → rejected avec la raison, les autres appliquées',
  r.length === 3 &&
    r[0].status === 'applied' &&
    r[1].status === 'rejected' &&
    /null/i.test(r[1].reason ?? '') &&
    r[2].status === 'applied',
  r,
);
const afterReject = await as(
  A,
  async () =>
    (
      await db.query(
        "select id from public.subjects where id in ('s-ok1', 's-bad', 's-ok2') order by id",
      )
    ).rows,
);
check(
  'la ligne rejetée est absente, les deux autres présentes',
  afterReject.map((x) => x.id).join(',') === 's-ok1,s-ok2',
  afterReject,
);
r = await push(A, [
  {
    mutation_id: 'r2',
    entity: 'subjects',
    entity_id: 's-bad',
    operation: 'create',
    base_version: null,
    payload: { ...create.payload, id: 's-bad', name: 'Corrigée' },
  },
]);
check(
  'une modification rejetée n’est pas mémorisée : renvoyée corrigée, elle passe',
  r[0].status === 'applied',
  r,
);

let refused = false;
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
