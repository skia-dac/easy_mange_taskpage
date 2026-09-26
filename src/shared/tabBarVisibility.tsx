import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';

const SetScrollingContext = createContext<(scrolling: boolean) => void>(() => {});
const HiddenContext = createContext(false);

/** La barre d'onglets se cache pendant le défilement, et revient quand il s'arrête. */
export function TabBarVisibility({ children }: { children: ReactNode }) {
  const [scrolling, setScrolling] = useState(false);
  const [reader, setReader] = useState(false);
  const set = useCallback((value: boolean) => {
    setScrolling((prev) => (prev === value ? prev : value));
  }, []);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setReader);
    void AccessibilityInfo.isScreenReaderEnabled().then(setReader);
    return () => sub.remove();
  }, []);

  return (
    <SetScrollingContext.Provider value={set}>
      <HiddenContext.Provider value={scrolling && !reader}>{children}</HiddenContext.Provider>
    </SetScrollingContext.Provider>
  );
}

/** Vrai pendant un défilement, faux dès qu'il s'est arrêté. Reste faux avec un lecteur d'écran. */
export function useTabBarHidden() {
  return useContext(HiddenContext);
}

export function useSetTabBarScrolling() {
  return useContext(SetScrollingContext);
}

/** Hauteur de la barre, ou 0 hors des onglets. Le contenu peut défiler dessous. */
export function useTabBarInset() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}

const STOP_MS = 180;

/**
 * À brancher sur le défilement principal. La barre disparaît tant que le doigt
 * (ou l'élan) bouge, et revient un court instant après l'arrêt.
 */
export function useTabBarScrollHandlers() {
  const setScrolling = useSetTabBarScrolling();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onScroll = useCallback(() => {
    if (!hidden.current) {
      hidden.current = true;
      setScrolling(true);
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      hidden.current = false;
      setScrolling(false);
    }, STOP_MS);
  }, [setScrolling]);

  return { onScroll, scrollEventThrottle: 16 as const };
}
