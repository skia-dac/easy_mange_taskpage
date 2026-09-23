import { Alert } from 'react-native';

import { i18n } from '../i18n';

/** Demande confirmation avant une action destructive (§90). Résout `true` si confirmé. */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: i18n.t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/** Message d'erreur simple, compréhensible (jamais technique). */
export function showError(messageKey: string): void {
  Alert.alert(i18n.t('errors.title'), i18n.t(messageKey));
}
