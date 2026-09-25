import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/shared/errors';

import type { Mutation, PushResult, RemoteApi, SyncedTable } from './engine';

function isNetwork(error: { message?: string; code?: string } | null): boolean {
  const m = (error?.message ?? '').toLowerCase();
  return m.includes('network') || m.includes('fetch') || m.includes('timeout');
}

function toError(error: { message?: string; code?: string }, where: string): AppError {
  return isNetwork(error)
    ? new AppError('network', where, { cause: error })
    : new AppError('unknown', `${where}: ${error.code ?? ''}`, { cause: error });
}

/** Serveur réel : fonction SQL `mysky_push` pour l'envoi, lecture par curseur pour la réception. */
export function supabaseRemote(client: SupabaseClient): RemoteApi {
  return {
    async push(mutations: Mutation[]): Promise<PushResult[]> {
      const { data, error } = await client.rpc('mysky_push', { p_mutations: mutations });
      if (error) throw toError(error, 'push');
      return (data ?? []) as PushResult[];
    },
    async pull(table: SyncedTable, since: string | null, limit: number) {
      let q = client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .limit(limit);
      if (since) q = q.gt('server_updated_at', since);
      const { data, error } = await q;
      if (error) throw toError(error, `pull:${table}`);
      return (data ?? []) as Record<string, unknown>[];
    },
  };
}
