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
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';

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
 * À brancher sur le défilement principal. La barre et le bouton + ne partent
 * que quand le doigt (ou l'élan qui suit) fait bouger la liste. Un changement
 * de mise en page ne compte pas. Ils reviennent un court instant après l'arrêt.
 */
export function useTabBarScrollHandlers() {
  const setScrolling = useSetTabBarScrolling();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hidden = useRef(false);
  const dragging = useRef(false);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (hidden.current) return;
    hidden.current = true;
    setScrolling(true);
  }, [setScrolling]);

  const showSoon = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (dragging.current) return;
      hidden.current = false;
      setScrolling(false);
    }, STOP_MS);
  }, [setScrolling]);

  const onScrollBeginDrag = useCallback(() => {
    dragging.current = true;
    hide();
  }, [hide]);

  const onScrollEndDrag = useCallback(() => {
    dragging.current = false;
    showSoon();
  }, [showSoon]);

  const onMomentumScrollBegin = useCallback(() => {
    dragging.current = true;
    hide();
  }, [hide]);

  const onMomentumScrollEnd = useCallback(() => {
    dragging.current = false;
    showSoon();
  }, [showSoon]);

  return {
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollBegin,
    onMomentumScrollEnd,
  };
}
