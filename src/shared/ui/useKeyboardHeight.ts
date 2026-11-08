import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hauteur du clavier à l'écran (0 s'il est fermé). iOS prévient juste avant l'apparition
 * (« will ») ; Android seulement après (« did »).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
