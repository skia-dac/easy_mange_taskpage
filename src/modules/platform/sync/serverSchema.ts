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
/** Taille maximale d'un fichier dans le bucket (25 Mo, comme MAX_ATTACHMENT_MB). */
export const FILE_SIZE_LIMIT = 25 * 1024 * 1024;

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
    // Projet déjà créé avec une version plus ancienne : relancer le fichier ajoute les colonnes
    // manquantes (une colonne ajoutée plus tard a toujours une valeur par défaut ou accepte NULL).
    const adds = defs
      .slice(1)
      .map((d) => `  add column if not exists ${d.trim()}`)
      .join(',\n');
    out.push(
      `create table if not exists public.${table} (`,
      defs.join(',\n'),
      ');',
      `alter table public.${table}`,
      `${adds};`,
      `create index if not exists ${table}_sync_idx on public.${table} (user_id, server_updated_at);`,
      `alter table public.${table} enable row level security;`,
      `drop policy if exists "own rows" on public.${table};`,
      `create policy "own rows" on public.${table} for all to authenticated`,
      '  using (user_id = auth.uid()) with check (user_id = auth.uid());',
      // Lecture directe seulement : toute écriture passe par mysky_push (versions, idempotence).
      `revoke insert, update, delete on public.${table} from authenticated;`,
      `grant select on public.${table} to authenticated;`,
      `drop trigger if exists ${table}_touch on public.${table};`,
      `create trigger ${table}_touch before insert or update on public.${table}`,
      '  for each row execute function public.mysky_touch();',
      '',
    );
  }

  out.push(
    '-- Modifications déjà appliquées (une même modification renvoyée après une coupure ne compte qu’une fois).',
    '-- Purgées après 30 jours au début de chaque mysky_push ; clé (user_id, mutation_id) : un identifiant',
    '-- de modification n’appartient qu’à son utilisateur.',
    'create table if not exists public.sync_mutations (',
    '  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,',
    '  mutation_id text not null,',
    '  entity text not null,',
    '  entity_id text not null,',
    '  result_version bigint not null,',
    '  created_at timestamptz not null default now(),',
    '  primary key (user_id, mutation_id)',
    ');',
    'alter table public.sync_mutations add column if not exists created_at timestamptz not null default now();',
    '-- Projet créé avec l’ancienne clé (mutation_id seule) : on passe à la clé composée.',
    'do $$ begin',
    "  if not exists (select 1 from pg_constraint where conrelid = 'public.sync_mutations'::regclass",
    "                 and contype = 'p' and array_length(conkey, 1) = 2) then",
    '    alter table public.sync_mutations drop constraint if exists sync_mutations_pkey;',
    '    alter table public.sync_mutations add primary key (user_id, mutation_id);',
    '  end if;',
    'end $$;',
    'create index if not exists sync_mutations_created_idx on public.sync_mutations (user_id, created_at);',
    'alter table public.sync_mutations enable row level security;',
    'drop policy if exists "own rows" on public.sync_mutations;',
    'create policy "own rows" on public.sync_mutations for all to authenticated',
    '  using (user_id = auth.uid()) with check (user_id = auth.uid());',
    'revoke insert, update, delete on public.sync_mutations from authenticated;',
    'grant select on public.sync_mutations to authenticated;',
    '',
    PUSH_FUNCTION.replace('__TABLES__', SYNCED_TABLES.map((t) => `'${t}'`).join(', ')),
    '',
    `-- Bucket privé ; ${FILE_SIZE_LIMIT} octets = 25 Mo, la limite d'une pièce jointe dans l'app.`,
    `insert into storage.buckets (id, name, public, file_size_limit)`,
    `  values ('${FILES_BUCKET}', '${FILES_BUCKET}', false, ${FILE_SIZE_LIMIT})`,
    '  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;',
    'drop policy if exists "mysky own files" on storage.objects;',
    'create policy "mysky own files" on storage.objects for all to authenticated',
    `  using (bucket_id = '${FILES_BUCKET}' and (storage.foldername(name))[1] = auth.uid()::text)`,
    `  with check (bucket_id = '${FILES_BUCKET}' and (storage.foldername(name))[1] = auth.uid()::text);`,
    '',
  );
  return out.join('\n');
}

const PUSH_FUNCTION = `-- Applique une liste de modifications envoyées par le téléphone, dans l'ordre.
-- Résultat par modification : applied (avec la nouvelle version), conflict (avec la ligne du serveur),
-- missing, ou rejected (la modification est invalide : les autres sont quand même appliquées).
-- « security definer » : les utilisateurs n'ont pas le droit d'écrire directement dans les tables ;
-- la fonction écrit pour eux, toujours limitée à leurs lignes (user_id = auth.uid() à chaque requête).
create or replace function public.mysky_push(p_mutations jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
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
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- Ménage : les identifiants de modification ne servent plus après 30 jours.
  delete from sync_mutations where user_id = v_user and created_at < now() - interval '30 days';
  for m in select value from jsonb_array_elements(p_mutations) loop
    v_mid := m->>'mutation_id';
    -- Chaque modification est isolée : une erreur (contrainte violée, table inconnue…) la rejette
    -- sans annuler les autres ni faire échouer l'appel.
    begin
      v_table := m->>'entity';
      v_id := m->>'entity_id';
      v_op := m->>'operation';
      v_base := nullif(m->>'base_version', '')::bigint;
      v_payload := coalesce(m->'payload', '{}'::jsonb) - 'id' - 'user_id' - 'version' - 'server_updated_at' - 'sync_status';
      if v_mid is null or v_id is null then
        raise exception 'mutation incomplète' using errcode = '22023';
      end if;
      if v_table is null or not (v_table = any (allowed)) then
        raise exception 'unknown entity %', v_table using errcode = '22023';
      end if;

      select result_version into v_prev from sync_mutations where user_id = v_user and mutation_id = v_mid;
      if found then
        results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_prev));
        continue;
      end if;

      execute format('select version from public.%I where id = $1 and user_id = $2', v_table) into v_current using v_id, v_user;

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
          -- La ligne existe déjà (ex. sauvegarde restaurée avant la première synchro) :
          -- on ne l'écrase pas en silence, le téléphone arbitre avec la version du serveur.
          execute format('select to_jsonb(t) - ''user_id'' from public.%I as t where id = $1 and user_id = $2', v_table) into v_row using v_id, v_user;
          results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'conflict', 'server', v_row));
          continue;
        else
          execute format(
            'insert into public.%I (id, user_id, version%s) select $1, $3, 1%s from jsonb_populate_record(null::public.%I, $2) as r',
            v_table, coalesce(', ' || v_cols, ''), coalesce(', ' || v_vals, ''), v_table)
            using v_id, v_payload, v_user;
          v_new := 1;
        end if;
      else
        if v_current is null then
          results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'missing'));
          continue;
        end if;
        if v_base is distinct from v_current then
          execute format('select to_jsonb(t) - ''user_id'' from public.%I as t where id = $1 and user_id = $2', v_table) into v_row using v_id, v_user;
          results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'conflict', 'server', v_row));
          continue;
        end if;
        execute format(
          'update public.%I as t set %sversion = t.version + 1 from jsonb_populate_record(null::public.%I, $2) as r where t.id = $1 and t.user_id = $3',
          v_table, coalesce(v_sets || ', ', ''), v_table)
          using v_id, v_payload, v_user;
        v_new := v_current + 1;
      end if;

      insert into sync_mutations (user_id, mutation_id, entity, entity_id, result_version) values (v_user, v_mid, v_table, v_id, v_new);
      results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_new));
    exception when others then
      results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'rejected', 'reason', sqlerrm));
    end;
  end loop;
  return results;
end $$;
revoke all on function public.mysky_push(jsonb) from public, anon;
grant execute on function public.mysky_push(jsonb) to authenticated;`;
