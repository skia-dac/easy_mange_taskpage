import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AccessibilityInfo } from 'react-native';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import { tabBarHidesOnScroll } from './ui/tabBarBehavior';

const SetScrollingContext = createContext<(scrolling: boolean) => void>(() => {});
const HiddenContext = createContext(false);

/**
 * La barre d'onglets se cache quand on descend dans une liste, et revient quand on remonte.
 * Android seulement : sur iPhone elle reste visible (voir `tabBarHidesOnScroll`).
 */
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
      <HiddenContext.Provider value={scrolling && !reader && tabBarHidesOnScroll()}>
        {children}
      </HiddenContext.Provider>
    </SetScrollingContext.Provider>
  );
}

/** Vrai quand on a descendu la liste, faux dès qu'on remonte. Reste faux avec un lecteur d'écran. */
export function useTabBarHidden() {
  return useContext(HiddenContext);
}

export function useSetTabBarScrolling() {
  return useContext(SetScrollingContext);
}

let measuredHeight = 0;
const heightListeners = new Set<() => void>();

/**
 * La barre d'onglets annonce sa hauteur mesurée. Ce qui vit au-dessus du navigateur (le toast,
 * monté à la racine) n'a pas accès au contexte des onglets : il la lit avec `useMeasuredTabBarHeight`.
 */
export function reportTabBarHeight(height: number) {
  if (height === measuredHeight) return;
  measuredHeight = height;
  heightListeners.forEach((l) => l());
}

/** Dernière hauteur mesurée de la barre d'onglets (0 tant qu'elle n'a pas été affichée). */
export function useMeasuredTabBarHeight() {
  return useSyncExternalStore(
    (listener) => {
      heightListeners.add(listener);
      return () => heightListeners.delete(listener);
    },
    () => measuredHeight,
  );
}

/** Hauteur de la barre, ou 0 hors des onglets. Le contenu peut défiler dessous. */
export function useTabBarInset() {
  return useContext(BottomTabBarHeightContext) ?? 0;
}

/** Défilement vers le bas à partir duquel la barre part (évite les tremblements du doigt). */
export const HIDE_DELTA = 12;
/** Près du haut de la liste, la barre reste toujours là. */
export const TOP_ZONE = 24;

/**
 * Règle iOS / Material : la barre part quand on descend nettement, revient dès qu'on remonte
 * ou qu'on est en haut. `anchor` : position où la direction a changé pour la dernière fois.
 */
export function nextTabBarState(
  state: { hidden: boolean; anchor: number },
  y: number,
): { hidden: boolean; anchor: number } {
  if (y <= TOP_ZONE) return { hidden: false, anchor: y };
  if (state.hidden) {
    // Cachée : la moindre remontée la ramène.
    if (y < state.anchor) return { hidden: false, anchor: y };
    return { hidden: true, anchor: y };
  }
  if (y < state.anchor) return { hidden: false, anchor: y };
  if (y - state.anchor >= HIDE_DELTA) return { hidden: true, anchor: y };
  return state;
}

type ScrollEvent = { nativeEvent: { contentOffset: { y: number } } };

/**
 * À brancher sur le défilement principal. La barre et le bouton + partent quand on descend
 * dans la liste, et reviennent dès qu'on remonte ou qu'on revient en haut. Un changement de mise
 * en page ne bouge pas la position : il ne compte pas.
 */
export function useTabBarScrollHandlers() {
  const setHidden = useSetTabBarScrolling();
  const state = useRef({ hidden: false, anchor: 0 });

  // Écran quitté : la barre revient.
  useEffect(() => () => setHidden(false), [setHidden]);

  const onScroll = useCallback(
    (event: ScrollEvent) => {
      const next = nextTabBarState(state.current, event.nativeEvent.contentOffset.y);
      if (next.hidden !== state.current.hidden) setHidden(next.hidden);
      state.current = next;
    },
    [setHidden],
  );

  return { onScroll, scrollEventThrottle: 32 };
}
