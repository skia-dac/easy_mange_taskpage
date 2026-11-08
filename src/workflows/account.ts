import {
  AccountError,
  deleteRemoteAccount,
  getAccountOwner,
  getProfile,
  saveProfile,
  setAccountOwner,
  setOnboardingDone,
  signOut,
} from '@/modules/identity';
import { conflictCount, pendingCount, runSync, withSyncPaused } from '@/modules/platform';
import type { Db } from '@/shared/db';
import { logger } from '@/shared/logger';

import { wipeAllData } from './wipeAllData';

export type ClaimResult = 'ok' | 'otherAccount';

/**
 * Après une connexion : relie les données de ce téléphone au compte.
 * - Données sans propriétaire (créées avant d'avoir un compte) → elles rejoignent le compte
 *   et seront envoyées à la première synchronisation.
 * - Données d'un AUTRE compte → on ne mélange jamais : il faut d'abord les effacer du téléphone.
 */
export async function claimLocalData(db: Db, userId: string): Promise<ClaimResult> {
  const owner = await getAccountOwner(db);
  if (owner === userId) return 'ok';
  if (owner) return 'otherAccount';
  await setAccountOwner(db, userId);
  return 'ok';
}

/** Efface les données d'un autre compte présentes sur ce téléphone, puis le relie au compte connecté. */
export async function replaceLocalDataWithAccount(db: Db, userId: string): Promise<void> {
  // Aucune synchronisation entre l'effacement et le nouveau propriétaire.
  await withSyncPaused(async () => {
    await wipeAllData(db);
    await setOnboardingDone(db);
    await setAccountOwner(db, userId);
  });
}

/** Pré-remplit le profil avec le prénom et le nom donnés à l'inscription (si le profil est vide). */
export async function fillProfileFromSignUp(
  db: Db,
  names: { firstName?: string | null; lastName?: string | null },
): Promise<void> {
  const current = await getProfile(db);
  if (current && (current.firstName || current.lastName)) return;
  if (!names.firstName && !names.lastName) return;
  await saveProfile(db, {
    firstName: names.firstName ?? '',
    lastName: names.lastName ?? '',
    university: current?.university ?? null,
    field: current?.field ?? null,
    level: current?.level ?? null,
    academicYear: current?.academicYear ?? null,
  });
}

/**
 * Ce que le serveur n'a pas encore : modifications en attente d'envoi et conflits non réglés
 * (la version gardée de côté n'existe que sur ce téléphone). Effacer le téléphone les perdrait.
 */
export async function unsyncedCount(db: Db): Promise<number> {
  const [pending, conflicts] = await Promise.all([pendingCount(db), conflictCount(db)]);
  return pending + conflicts;
}

/**
 * Avant d'effacer le téléphone : on tente un envoi, puis on compte ce qui n'est toujours pas
 * sur le serveur. `push` ne lève jamais (runSync) ; une erreur inattendue compte comme un échec.
 */
export async function pushBeforeErase(
  db: Db,
  userId: string,
  push: (db: Db, userId: string) => Promise<unknown> = runSync,
): Promise<number> {
  try {
    await push(db, userId);
  } catch (e) {
    logger.error(e, { where: 'pushBeforeErase' });
  }
  return unsyncedCount(db);
}

/**
 * Déconnexion de ce téléphone. Les données restent sur le compte (spécification §5.6).
 * `keepOnPhone` : garder aussi la copie du téléphone (utilisable hors connexion) ou l'effacer.
 * Effacer alors que des modifications ne sont pas envoyées est refusé, sauf si l'utilisateur l'a
 * explicitement accepté (`discardUnsynced`, après « Effacer quand même »).
 */
export async function signOutFromPhone(
  db: Db,
  keepOnPhone: boolean,
  options: { discardUnsynced?: boolean } = {},
): Promise<void> {
  if (!keepOnPhone && !options.discardUnsynced && (await unsyncedCount(db)) > 0)
    throw new AccountError('account.unsyncedBlocked');
  // La synchronisation en cours se termine avant la déconnexion, et aucune ne repart pendant.
  await withSyncPaused(async () => {
    await signOut();
    if (!keepOnPhone) await wipeAllData(db);
  });
}

/**
 * Supprime le compte partout : serveur (données et fichiers), puis ce téléphone. Une fois le
 * serveur supprimé, le téléphone est toujours détaché du compte et vidé, même si la déconnexion
 * locale échoue ; si le vidage échoue, l'erreur le dit clairement (le compte n'existe plus).
 */
export async function deleteAccountEverywhere(db: Db): Promise<void> {
  await withSyncPaused(() => deleteAccountAndWipe(db));
}

async function deleteAccountAndWipe(db: Db): Promise<void> {
  await deleteRemoteAccount();
  try {
    await signOut();
  } catch (e) {
    // Le compte n'existe plus : une déconnexion locale ratée ne doit pas empêcher le nettoyage.
    logger.warn('Déconnexion incomplète après suppression du compte', { where: 'deleteAccount' });
    logger.error(e, { where: 'deleteAccountEverywhere' });
  } finally {
    try {
      await setAccountOwner(db, null);
      await wipeAllData(db);
    } catch (e) {
      logger.error(e, { where: 'deleteAccountEverywhere' });
      throw new AccountError('auth.error.localWipeFailed', e);
    }
  }
}
