import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Vrai quand VoiceOver ou TalkBack est allumé ; suit les changements en direct. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (alive) setOn(value);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}
