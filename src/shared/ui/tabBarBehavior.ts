import { Platform } from 'react-native';

/**
 * La barre d'onglets part-elle quand on descend dans une liste ?
 *
 * - Android (Material 3) : oui, la barre du bas se cache au défilement et revient en remontant.
 * - iPhone : non. Depuis iOS 26, le système ne retire plus la barre d'onglets : il la réduit
 *   (« minimize »), et seulement avec la barre native. Notre barre est dessinée en JavaScript :
 *   imiter cette réduction serait approximatif, et la faire disparaître irait contre l'usage
 *   d'iOS. Elle reste donc visible, comme le bouton +.
 */
export function tabBarHidesOnScroll(): boolean {
  return Platform.OS === 'android';
}
