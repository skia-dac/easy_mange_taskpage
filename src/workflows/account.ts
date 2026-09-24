import {
  deleteRemoteAccount,
  getAccountOwner,
  getProfile,
  saveProfile,
  setAccountOwner,
  setOnboardingDone,
  signOut,
} from '@/modules/identity';
import type { Db } from '@/shared/db';

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
  await wipeAllData(db);
  await setOnboardingDone(db);
  await setAccountOwner(db, userId);
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
 * Déconnexion de ce téléphone. Les données restent sur le compte (spécification §5.6).
 * `keepOnPhone` : garder aussi la copie du téléphone (utilisable hors connexion) ou l'effacer.
 */
export async function signOutFromPhone(db: Db, keepOnPhone: boolean): Promise<void> {
  await signOut();
  if (!keepOnPhone) await wipeAllData(db);
}

/** Supprime le compte partout : serveur (données et fichiers), puis ce téléphone. */
export async function deleteAccountEverywhere(db: Db): Promise<void> {
  await deleteRemoteAccount();
  await signOut();
  await wipeAllData(db);
}
