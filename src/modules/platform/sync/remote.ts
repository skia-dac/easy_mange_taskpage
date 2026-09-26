import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { AppError } from '@/shared/errors';

import type { Mutation, PushResult, RemoteApi, SyncedTable } from './engine';

/** Réponses du serveur vérifiées avant usage : une forme inattendue devient une erreur claire. */
const pushResultSchema = z.discriminatedUnion('status', [
  z.object({ mutation_id: z.string(), status: z.literal('applied'), version: z.number() }),
  z.object({ mutation_id: z.string(), status: z.literal('missing') }),
  z.object({
    mutation_id: z.string(),
    status: z.literal('conflict'),
    server: z.record(z.string(), z.unknown()),
  }),
]);
const pushResponseSchema = z.array(pushResultSchema);
const pullResponseSchema = z.array(z.record(z.string(), z.unknown()));

function parseResponse<T>(schema: z.ZodType<T>, data: unknown, where: string): T {
  const parsed = schema.safeParse(data ?? []);
  if (!parsed.success) throw new AppError('unknown', `${where}: réponse inattendue`);
  return parsed.data;
}

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
      return parseResponse<PushResult[]>(pushResponseSchema, data, 'push');
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
      return parseResponse(pullResponseSchema, data, `pull:${table}`);
    },
  };
}
