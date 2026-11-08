import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { tabIcon } from '@/components/TabIcon';

import {
  HIDE_DELTA,
  nextTabBarState,
  TabBarVisibility,
  useTabBarHidden,
  useTabBarScrollHandlers,
} from './tabBarVisibility';

const scrollTo = (y: number) => ({ nativeEvent: { contentOffset: { y } } });

describe('barre d’onglets au défilement', () => {
  it('part en descendant, revient en remontant et en haut', () => {
    let s = { hidden: false, anchor: 0 };
    s = nextTabBarState(s, 100);
    expect(s.hidden).toBe(true);
    s = nextTabBarState(s, 300);
    expect(s.hidden).toBe(true);
    // Remonter un peu suffit.
    s = nextTabBarState(s, 290);
    expect(s.hidden).toBe(false);
    // Un petit tremblement vers le bas ne la cache pas.
    s = nextTabBarState(s, 290 + HIDE_DELTA - 1);
    expect(s.hidden).toBe(false);
    s = nextTabBarState(s, 290 + HIDE_DELTA + 1);
    expect(s.hidden).toBe(true);
    // En haut de la liste : toujours visible.
    s = nextTabBarState(s, 10);
    expect(s.hidden).toBe(false);
  });

  afterEach(() => jest.restoreAllMocks());

  it('Android : le hook cache la barre en descendant et la montre au défilement vers le haut', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TabBarVisibility>{children}</TabBarVisibility>
    );
    const h = await renderHook(
      () => ({ handlers: useTabBarScrollHandlers(), hidden: useTabBarHidden() }),
      { wrapper },
    );
    expect(h.result.current.hidden).toBe(false);
    await act(async () => h.result.current.handlers.onScroll(scrollTo(200)));
    expect(h.result.current.hidden).toBe(true);
    // Aucun minuteur : elle reste cachée tant qu'on ne remonte pas.
    await act(async () => h.result.current.handlers.onScroll(scrollTo(200)));
    expect(h.result.current.hidden).toBe(true);
    await act(async () => h.result.current.handlers.onScroll(scrollTo(150)));
    expect(h.result.current.hidden).toBe(false);
  });

  it('iPhone : la barre reste visible au défilement (iOS 26 la réduit, ne la retire pas)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TabBarVisibility>{children}</TabBarVisibility>
    );
    const h = await renderHook(
      () => ({ handlers: useTabBarScrollHandlers(), hidden: useTabBarHidden() }),
      { wrapper },
    );
    await act(async () => h.result.current.handlers.onScroll(scrollTo(200)));
    expect(h.result.current.hidden).toBe(false);
  });
});

describe('icônes des onglets', () => {
  it('une seule fonction par icône : pas de composant recréé à chaque rendu', () => {
    expect(tabIcon('sun')).toBe(tabIcon('sun'));
    expect(tabIcon('sun')).not.toBe(tabIcon('calendar'));
  });
});
