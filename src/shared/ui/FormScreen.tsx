import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { Button } from './Button';
import { FormScrollContext } from './formScroll';
import { KeyboardAvoiding } from './KeyboardAvoiding';

type Props = {
  children: ReactNode;
  submitLabel: string;
  onSubmit: () => void;
  saving?: boolean;
  /** Contenu sous le bouton (ex. « Supprimer »). */
  footer?: ReactNode;
};

/** Marge au-dessus du champ en erreur quand on défile jusqu'à lui. */
const REVEAL_MARGIN = 24;

/**
 * Formulaire : champs qui défilent au-dessus du clavier, gros bouton « Enregistrer » en bas.
 * Après un envoi refusé, il défile jusqu'au premier champ en erreur.
 */
export function FormScreen({ children, submitLabel, onSubmit, saving, footer }: Props) {
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const frame = useRef<View>(null);
  const offsetY = useRef(0);
  const lowest = useRef<number | null>(null);
  const flush = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Plusieurs champs peuvent se signaler d'un coup : on attend un instant et on va au plus haut.
  const reveal = useCallback((node: View) => {
    const host = frame.current;
    if (!host) return;
    host.measureInWindow((_hx, hostY) => {
      node.measureInWindow((_x, y) => {
        const target = Math.max(0, y - hostY + offsetY.current - REVEAL_MARGIN);
        lowest.current = lowest.current === null ? target : Math.min(lowest.current, target);
        if (flush.current) clearTimeout(flush.current);
        flush.current = setTimeout(() => {
          if (lowest.current !== null)
            scroll.current?.scrollTo({ y: lowest.current, animated: true });
          lowest.current = null;
        }, 50);
      });
    });
  }, []);
  const context = useMemo(() => ({ attempt, reveal }), [attempt, reveal]);

  const submit = () => {
    setAttempt((a) => a + 1);
    onSubmit();
  };

  return (
    <FormScrollContext.Provider value={context}>
      <KeyboardAvoiding>
        <View ref={frame} collapsable={false} style={{ flex: 1 }}>
          <ScrollView
            ref={scroll}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={32}
            onScroll={(e) => {
              offsetY.current = e.nativeEvent.contentOffset.y;
            }}
            contentContainerStyle={{
              padding: spacing.xl,
              gap: spacing.lg,
              paddingBottom: spacing.xxl + insets.bottom,
            }}
          >
            {children}
            <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
              <Button label={submitLabel} onPress={submit} disabled={saving} />
              {footer}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoiding>
    </FormScrollContext.Provider>
  );
}
