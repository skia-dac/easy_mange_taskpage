import { useEffect, useState } from 'react';

/**
 * La valeur, mais seulement quand elle n'a plus changé depuis `delayMs` : une recherche tapée ne
 * relance pas la base à chaque lettre. Une valeur vide passe sans attendre (effacer = immédiat).
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), value === '' ? 0 : delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return settled;
}
