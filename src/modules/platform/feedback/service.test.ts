import type { SupabaseClient } from '@supabase/supabase-js';
import { Linking } from 'react-native';

import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { clearDatabase } from '../backup/snapshot';
import { createFeedback, feedbackCounts, getDeviceRef, listFeedback } from './data';
import { deleteFeedback, retryFeedback, sendPendingFeedback, submitFeedback } from './service';

const context = { appVersion: '1.0.0', os: 'iOS 18.1', locale: 'fr' };
const input = { kind: 'bug', area: 'tasks', message: 'Le bouton Terminer ne répond pas.' } as const;

type Call = { fn: string; args: { p: Record<string, unknown> } };

/** Faux client Supabase : RPC et dépôt de fichier, avec une panne réseau à la demande. */
function fakeClient(options: { userId?: string | null; offline?: boolean } = {}) {
  const state = { offline: options.offline ?? false, calls: [] as Call[], uploads: [] as string[] };
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: options.userId ? { user: { id: options.userId } } : null },
      }),
    },
    rpc: async (fn: string, args: Call['args']) => {
      if (state.offline)
        return { data: null, error: { message: 'TypeError: Network request failed' } };
      state.calls.push({ fn, args });
      return { data: args.p.id, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          if (state.offline) return { error: { message: 'Network request failed' } };
          state.uploads.push(`${bucket}/${path}`);
          return { error: null };
        },
      }),
    },
  };
  return { client: client as unknown as SupabaseClient, state };
}

beforeAll(() => i18n.changeLanguage('fr'));

describe('retours : données locales', () => {
  it('enregistre le retour sur le téléphone, en attente d’envoi, hors file de synchronisation', async () => {
    const db = await createTestDb();
    const id = await createFeedback(
      db,
      { ...input, blocking: true, errorName: 'TypeError' },
      context,
    );
    const [f] = await listFeedback(db);
    expect(f).toMatchObject({
      id,
      status: 'pending',
      blocking: true,
      errorName: 'TypeError',
      os: 'iOS 18.1',
    });
    const outbox = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM sync_outbox',
      [],
    );
    expect(outbox?.n).toBe(0);
    expect(await feedbackCounts(db)).toEqual({ total: 1, pending: 1 });
    db.close();
  });

  it('crée un identifiant d’appareil aléatoire une seule fois', async () => {
    const db = await createTestDb();
    const a = await getDeviceRef(db);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getDeviceRef(db)).toBe(a);
    db.close();
  });

  it('« Supprimer toutes mes données » vide aussi les retours', async () => {
    const db = await createTestDb();
    await createFeedback(db, input, context);
    await clearDatabase(db);
    expect(await listFeedback(db)).toHaveLength(0);
    db.close();
  });

  it('supprime seulement un retour en attente', async () => {
    const db = await createTestDb();
    const id = await createFeedback(db, input, context);
    await deleteFeedback(db, id);
    expect(await listFeedback(db)).toHaveLength(0);
    db.close();
  });
});

describe('retours : envoi', () => {
  it('envoie au serveur et marque « envoyé »', async () => {
    const db = await createTestDb();
    const { client, state } = fakeClient();
    const { id, outcome } = await submitFeedback(
      db,
      { ...input, contactEmail: 'awa@mail.cm' },
      client,
    );
    expect(outcome).toBe('sent');
    expect(state.calls).toHaveLength(1);
    expect(state.calls[0]!.fn).toBe('mysky_submit_feedback');
    expect(state.calls[0]!.args.p).toMatchObject({
      id,
      kind: 'bug',
      area: 'tasks',
      contact_email: 'awa@mail.cm',
      device_ref: await getDeviceRef(db),
      screenshot_path: null,
    });
    // Le téléphone n'envoie jamais user_id : le serveur le pose lui-même.
    expect(state.calls[0]!.args.p).not.toHaveProperty('user_id');
    const [f] = await listFeedback(db);
    expect(f?.status).toBe('sent');
    expect(f?.sentAt).not.toBeNull();
    // Un retour envoyé n'est plus supprimable d'ici.
    await deleteFeedback(db, id);
    expect(await listFeedback(db)).toHaveLength(1);
    db.close();
  });

  it('hors ligne : reste en attente, puis part au nouvel essai', async () => {
    const db = await createTestDb();
    const { client, state } = fakeClient({ offline: true });
    const { outcome } = await submitFeedback(db, input, client);
    expect(outcome).toBe('queued');
    let [f] = await listFeedback(db);
    expect(f).toMatchObject({ status: 'pending', errorCode: 'network' });

    state.offline = false;
    expect(await sendPendingFeedback(db, client)).toEqual({ sent: 1, pending: 0 });
    [f] = await listFeedback(db);
    expect(f).toMatchObject({ status: 'sent', errorCode: null });
    // Déjà envoyé : un nouvel essai ne renvoie rien.
    expect(await sendPendingFeedback(db, client)).toEqual({ sent: 0, pending: 0 });
    expect(state.calls).toHaveLength(1);
    db.close();
  });

  it('connecté : dépose d’abord la capture dans le dossier du compte', async () => {
    const db = await createTestDb();
    const { client, state } = fakeClient({ userId: 'user-1' });
    const id = await createFeedback(
      db,
      { ...input, screenshotPath: 'attachments/feedback/shot.png' },
      context,
    );
    const readFile = async () => ({ bytes: new Uint8Array([1, 2, 3]), type: 'image/png' });
    expect(await sendPendingFeedback(db, client, { readFile })).toEqual({ sent: 1, pending: 0 });
    expect(state.uploads).toEqual([`mysky-feedback/user-1/${id}.png`]);
    expect(state.calls[0]!.args.p.screenshot_path).toBe(`user-1/${id}.png`);
    db.close();
  });

  it('sans compte : la capture n’est pas envoyée', async () => {
    const db = await createTestDb();
    const { client, state } = fakeClient({ userId: null });
    await createFeedback(
      db,
      { ...input, screenshotPath: 'attachments/feedback/shot.png' },
      context,
    );
    const readFile = jest.fn(async () => ({ bytes: new Uint8Array([1]), type: 'image/png' }));
    await sendPendingFeedback(db, client, { readFile });
    expect(readFile).not.toHaveBeenCalled();
    expect(state.uploads).toEqual([]);
    expect(state.calls[0]!.args.p.screenshot_path).toBeNull();
    db.close();
  });

  it('sans serveur configuré : ouvre la messagerie avec le retour, puis le marque envoyé', async () => {
    const db = await createTestDb();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { outcome } = await submitFeedback(db, { ...input, blocking: true }, null);
    expect(outcome).toBe('mailed');
    const url = String(open.mock.calls[0]![0]);
    expect(url.startsWith('mailto:kamgayvanarmel@gmail.com?subject=')).toBe(true);
    const body = decodeURIComponent(url.split('&body=')[1]!);
    expect(body).toContain('Type : Un problème');
    expect(body).toContain('Partie : Tâches');
    expect(body).toContain('Bloquant : oui');
    expect(body).toContain(input.message);
    expect((await listFeedback(db))[0]?.status).toBe('sent');
    open.mockRestore();
    db.close();
  });

  it('messagerie indisponible : le retour reste en attente et peut être renvoyé', async () => {
    const db = await createTestDb();
    const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('no app'));
    expect((await submitFeedback(db, input, null)).outcome).toBe('mailFailed');
    expect((await listFeedback(db))[0]?.status).toBe('pending');
    open.mockResolvedValue(true);
    expect(await retryFeedback(db, null)).toEqual({ sent: 1, pending: 0 });
    expect((await listFeedback(db))[0]?.status).toBe('sent');
    open.mockRestore();
    db.close();
  });
});
