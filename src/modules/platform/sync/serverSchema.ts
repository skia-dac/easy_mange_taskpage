import { SYNCED_TABLES, type Db } from '@/shared/db';

/**
 * Génère le schéma Postgres (Supabase) à partir du schéma SQLite du téléphone :
 * mêmes tables, mêmes colonnes, mêmes valeurs par défaut, plus :
 * - `user_id` (propriétaire, supprimé en cascade avec le compte) et la sécurité par ligne (RLS) ;
 * - `server_updated_at` (curseur de synchronisation, posé par le serveur) ;
 * - la fonction `mysky_push` qui applique la file de modifications du téléphone
 *   (idempotente, avec détection de conflit par numéro de version) ;
 * - le bucket de fichiers privé, rangé par utilisateur.
 * Un test vérifie que supabase/migrations/…_mysky.sql est à jour.
 */

type Column = { name: string; type: string; notnull: number; dflt_value: string | null };

const SERVER_ONLY = new Set(['sync_status']);

function pgType(sqlite: string): string {
  const t = sqlite.toUpperCase();
  if (t.includes('INT')) return 'bigint';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'double precision';
  return 'text';
}

async function columnsOf(db: Db, table: string): Promise<Column[]> {
  return db.getAllAsync<Column>(`PRAGMA table_info(${table})`, []);
}

export const FILES_BUCKET = 'mysky-files';

export async function generateServerSql(db: Db): Promise<string> {
  const out: string[] = [
    '-- MySky : schéma du serveur (Supabase). FICHIER GÉNÉRÉ, ne pas modifier à la main :',
    '-- UPDATE_SERVER_SCHEMA=1 npx jest serverSchema  (voir src/modules/platform/sync/serverSchema.ts)',
    '',
    'create or replace function public.mysky_touch() returns trigger language plpgsql as $$',
    'begin',
    '  new.server_updated_at := clock_timestamp();',
    '  return new;',
    'end $$;',
    '',
  ];

  for (const table of SYNCED_TABLES) {
    const cols = (await columnsOf(db, table)).filter((c) => !SERVER_ONLY.has(c.name));
    const defs = cols.map((c) => {
      if (c.name === 'id') return '  id text primary key';
      const parts = [`  ${c.name} ${pgType(c.type)}`];
      if (c.notnull) parts.push('not null');
      if (c.dflt_value !== null) parts.push(`default ${c.dflt_value}`);
      return parts.join(' ');
    });
    defs.splice(
      1,
      0,
      '  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade',
    );
    defs.push('  server_updated_at timestamptz not null default clock_timestamp()');
    out.push(
      `create table if not exists public.${table} (`,
      defs.join(',\n'),
      ');',
      `create index if not exists ${table}_sync_idx on public.${table} (user_id, server_updated_at);`,
      `alter table public.${table} enable row level security;`,
      `drop policy if exists "own rows" on public.${table};`,
      `create policy "own rows" on public.${table} for all to authenticated`,
      '  using (user_id = auth.uid()) with check (user_id = auth.uid());',
      `grant select, insert, update, delete on public.${table} to authenticated;`,
      `drop trigger if exists ${table}_touch on public.${table};`,
      `create trigger ${table}_touch before insert or update on public.${table}`,
      '  for each row execute function public.mysky_touch();',
      '',
    );
  }

  out.push(
    '-- Modifications déjà appliquées (une même modification renvoyée après une coupure ne compte qu’une fois).',
    'create table if not exists public.sync_mutations (',
    '  mutation_id text primary key,',
    '  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,',
    '  entity text not null,',
    '  entity_id text not null,',
    '  result_version bigint not null,',
    '  applied_at timestamptz not null default now()',
    ');',
    'alter table public.sync_mutations enable row level security;',
    'drop policy if exists "own rows" on public.sync_mutations;',
    'create policy "own rows" on public.sync_mutations for all to authenticated',
    '  using (user_id = auth.uid()) with check (user_id = auth.uid());',
    'grant select, insert on public.sync_mutations to authenticated;',
    '',
    PUSH_FUNCTION.replace('__TABLES__', SYNCED_TABLES.map((t) => `'${t}'`).join(', ')),
    '',
    `insert into storage.buckets (id, name, public) values ('${FILES_BUCKET}', '${FILES_BUCKET}', false)`,
    '  on conflict (id) do nothing;',
    'drop policy if exists "mysky own files" on storage.objects;',
    'create policy "mysky own files" on storage.objects for all to authenticated',
    `  using (bucket_id = '${FILES_BUCKET}' and (storage.foldername(name))[1] = auth.uid()::text)`,
    `  with check (bucket_id = '${FILES_BUCKET}' and (storage.foldername(name))[1] = auth.uid()::text);`,
    '',
  );
  return out.join('\n');
}

const PUSH_FUNCTION = `-- Applique une liste de modifications envoyées par le téléphone, dans l'ordre.
-- Résultat par modification : applied (avec la nouvelle version), conflict (avec la ligne du serveur) ou missing.
create or replace function public.mysky_push(p_mutations jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  m jsonb;
  results jsonb := '[]'::jsonb;
  v_mid text;
  v_table text;
  v_id text;
  v_op text;
  v_base bigint;
  v_payload jsonb;
  v_current bigint;
  v_prev bigint;
  v_cols text;
  v_vals text;
  v_sets text;
  v_new bigint;
  v_row jsonb;
  allowed text[] := array[__TABLES__];
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  for m in select value from jsonb_array_elements(p_mutations) loop
    v_mid := m->>'mutation_id';
    v_table := m->>'entity';
    v_id := m->>'entity_id';
    v_op := m->>'operation';
    v_base := nullif(m->>'base_version', '')::bigint;
    v_payload := coalesce(m->'payload', '{}'::jsonb) - 'id' - 'user_id' - 'version' - 'server_updated_at' - 'sync_status';
    if v_table is null or not (v_table = any (allowed)) then
      raise exception 'unknown entity %', v_table using errcode = '22023';
    end if;

    select result_version into v_prev from sync_mutations where mutation_id = v_mid;
    if found then
      results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_prev));
      continue;
    end if;

    execute format('select version from public.%I where id = $1', v_table) into v_current using v_id;

    select string_agg(quote_ident(k), ', '),
           string_agg('r.' || quote_ident(k), ', '),
           string_agg(quote_ident(k) || ' = r.' || quote_ident(k), ', ')
      into v_cols, v_vals, v_sets
      from jsonb_object_keys(v_payload) as k
     where exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = v_table and c.column_name = k
          and c.column_name not in ('id', 'user_id', 'version', 'server_updated_at'));

    if v_op = 'create' then
      if v_current is not null then
        v_new := v_current;
      else
        execute format(
          'insert into public.%I (id, version%s) select $1, 1%s from jsonb_populate_record(null::public.%I, $2) as r',
          v_table, coalesce(', ' || v_cols, ''), coalesce(', ' || v_vals, ''), v_table)
          using v_id, v_payload;
        v_new := 1;
      end if;
    else
      if v_current is null then
        results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'missing'));
        continue;
      end if;
      if v_base is distinct from v_current then
        execute format('select to_jsonb(t) - ''user_id'' from public.%I as t where id = $1', v_table) into v_row using v_id;
        results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'conflict', 'server', v_row));
        continue;
      end if;
      execute format(
        'update public.%I as t set %sversion = t.version + 1 from jsonb_populate_record(null::public.%I, $2) as r where t.id = $1',
        v_table, coalesce(v_sets || ', ', ''), v_table)
        using v_id, v_payload;
      v_new := v_current + 1;
    end if;

    insert into sync_mutations (mutation_id, entity, entity_id, result_version) values (v_mid, v_table, v_id, v_new);
    results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_new));
  end loop;
  return results;
end $$;
revoke all on function public.mysky_push(jsonb) from public, anon;
grant execute on function public.mysky_push(jsonb) to authenticated;`;
