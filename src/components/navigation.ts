import { router, type Href } from 'expo-router';

/**
 * Retour en arrière sûr : s'il n'y a rien derrière (ouverture à froid depuis une notification
 * ou un lien `mysky://`), on va à l'écran indiqué au lieu de ne rien faire.
 */
export function goBack(fallback: Href = '/(tabs)'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Après une suppression depuis un formulaire de modification : retour à la liste (racine). */
export function backToList(fallback: Href = '/(tabs)'): void {
  if (router.canDismiss()) router.dismissAll();
  else router.replace(fallback);
}
