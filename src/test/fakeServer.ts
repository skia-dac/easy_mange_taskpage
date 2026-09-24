import type { Mutation, PushResult, RemoteApi, SyncedTable } from '@/modules/platform';

/**
 * Faux serveur pour les tests : même logique que la fonction SQL `mysky_push`
 * (versions, modifications déjà appliquées, conflits) et que la lecture par curseur.
 * Le vrai SQL est vérifié à part sur Postgres (npm run test:server).
 */
export class FakeServer {
  tables = new Map<string, Map<string, Record<string, unknown>>>();
  applied = new Map<string, number>();
  private clock = 0;
  /** Simule une réponse perdue : la modification est appliquée mais le téléphone reçoit une erreur. */
  loseNextResponse = false;

  private table(name: string) {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  private stamp(): string {
    this.clock += 1;
    return new Date(Date.UTC(2030, 0, 1) + this.clock).toISOString();
  }

  rows(name: string): Record<string, unknown>[] {
    return [...this.table(name).values()];
  }

  remote(): RemoteApi {
    return {
      push: async (mutations) => {
        const out = mutations.map((m) => this.apply(m));
        if (this.loseNextResponse) {
          this.loseNextResponse = false;
          throw new Error('network lost');
        }
        return out;
      },
      pull: async (table: SyncedTable, since, limit) =>
        this.rows(table)
          .filter((r) => since === null || String(r.server_updated_at) > since)
          .sort((a, b) => String(a.server_updated_at).localeCompare(String(b.server_updated_at)))
          .slice(0, limit)
          .map((r) => ({ ...r })),
    };
  }

  private apply(m: Mutation): PushResult {
    const done = this.applied.get(m.mutation_id);
    if (done !== undefined) return { mutation_id: m.mutation_id, status: 'applied', version: done };
    const t = this.table(m.entity);
    const current = t.get(m.entity_id);
    const payload = { ...m.payload };
    delete payload.id;
    delete payload.version;
    let version: number;
    if (m.operation === 'create') {
      if (current) version = Number(current.version);
      else {
        t.set(m.entity_id, {
          ...payload,
          id: m.entity_id,
          version: 1,
          server_updated_at: this.stamp(),
        });
        version = 1;
      }
    } else {
      if (!current) return { mutation_id: m.mutation_id, status: 'missing' };
      if (m.base_version !== Number(current.version))
        return { mutation_id: m.mutation_id, status: 'conflict', server: { ...current } };
      version = Number(current.version) + 1;
      t.set(m.entity_id, { ...current, ...payload, version, server_updated_at: this.stamp() });
    }
    this.applied.set(m.mutation_id, version);
    return { mutation_id: m.mutation_id, status: 'applied', version };
  }
}
