import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText } from './AppText';

const COUNT_MS = 720;

/**
 * Passe de 0 au montant, une seule fois à l'ouverture.
 * Ensuite (autre mois, rafraîchissement) le nombre se met à jour sans recompter.
 * Rien à animer si les animations sont coupées.
 */
export function useCountUp(target: number): number {
  const reduced = useReducedMotion();
  const still = Boolean(reduced) || typeof (globalThis as { jest?: unknown }).jest !== 'undefined';
  const [value, setValue] = useState(0);
  const played = useRef(false);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    let cancelled = false;
    if (played.current) {
      frame = requestAnimationFrame(() => {
        if (!cancelled) setValue(target);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const t = Math.min(1, (Date.now() - start) / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else played.current = true;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [still, target]);

  return still ? target : value;
}

type Props = Omit<ComponentProps<typeof AppText>, 'children'> & {
  value: number;
  format: (n: number) => string;
};

/** Affiche un montant qui compte jusqu'à sa valeur. Le lecteur d'écran entend le total final. */
export function CountUpText({ value, format, ...rest }: Props) {
  const shown = useCountUp(value);
  return (
    <AppText {...rest} accessibilityLabel={format(value)}>
      {format(shown)}
    </AppText>
  );
}
