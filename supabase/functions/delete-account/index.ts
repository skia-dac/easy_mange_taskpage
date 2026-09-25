// Supabase Edge Function « delete-account » (Deno) : supprime le compte de l'utilisateur connecté.
// - Vérifie le jeton de l'utilisateur (on ne supprime que SON compte).
// - Efface ses fichiers du bucket, puis son compte : ses lignes partent en cascade (user_id → auth.users).
// La clé service_role est lue côté serveur (variable fournie par Supabase), jamais dans l'app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const BUCKET = 'mysky-files';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'server_misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  const userId = data.user.id;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Fichiers : liste récursive du dossier de l'utilisateur, puis suppression par lots.
  const paths: string[] = [];
  async function collect(prefix: string): Promise<void> {
    for (let offset = 0; ; offset += 1000) {
      const { data: items, error: listError } = await admin.storage
        .from(BUCKET)
        .list(prefix, { limit: 1000, offset });
      if (listError) throw listError;
      if (!items || items.length === 0) return;
      for (const item of items) {
        const path = `${prefix}/${item.name}`;
        if (item.id === null) await collect(path);
        else paths.push(path);
      }
      if (items.length < 1000) return;
    }
  }
  try {
    await collect(userId);
    for (let i = 0; i < paths.length; i += 500) {
      const { error: removeError } = await admin.storage
        .from(BUCKET)
        .remove(paths.slice(i, i + 500));
      if (removeError) throw removeError;
    }
  } catch (_e) {
    return json({ error: 'files_not_deleted' }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: 'account_not_deleted' }, 500);
  return json({ ok: true, files: paths.length });
});
