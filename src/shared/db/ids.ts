import { randomUUID } from 'expo-crypto';

/** Identifiant stable créé sur le téléphone (permet de créer hors connexion sans doublon). */
export function newId(): string {
  return randomUUID();
}

/** Date et heure au format ISO 8601 (UTC), pour created_at / updated_at. */
export function nowIso(): string {
  return new Date().toISOString();
}
