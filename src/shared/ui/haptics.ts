import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Retours tactiles de MySky : un seul endroit, quatre gestes, pas plus.
 * - `selection` : un choix change (interrupteur, segment, pastille) ;
 * - `complete` : une tâche ou une habitude est cochée ;
 * - `success` : un formulaire est enregistré ;
 * - `warning` : juste avant de demander confirmation d'une suppression.
 *
 * Sur Android on passe par le moteur haptique du système (comme iOS, sans vibreur ni
 * permission). Rien sur le web. Un échec (mode économie d'énergie, appareil sans moteur) est
 * ignoré : le retour tactile n'est jamais nécessaire.
 */
export type HapticKind = 'selection' | 'complete' | 'success' | 'warning';

function play(kind: HapticKind): Promise<void> {
  if (Platform.OS === 'android') {
    const type = {
      selection: Haptics.AndroidHaptics.Clock_Tick,
      complete: Haptics.AndroidHaptics.Context_Click,
      success: Haptics.AndroidHaptics.Confirm,
      warning: Haptics.AndroidHaptics.Reject,
    }[kind];
    return Haptics.performAndroidHapticsAsync(type);
  }
  switch (kind) {
    case 'selection':
      return Haptics.selectionAsync();
    case 'complete':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
}

export function haptic(kind: HapticKind): void {
  if (Platform.OS === 'web') return;
  try {
    void play(kind).catch(() => undefined);
  } catch {
    // Module absent (tests, environnement sans moteur) : rien.
  }
}
