import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { notifyChange } from './changes';
import type { Db } from './types';
import {
  FOREGROUND_REFRESH_MS,
  shouldRefreshOnForeground,
  useSharedLiveQuery,
} from './useSharedLiveQuery';

const fakeDb = { id: 'db' } as unknown as Db;
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => fakeDb }));

const flush = () => act(async () => Promise.resolve());

describe('useSharedLiveQuery', () => {
  it('lit une seule fois pour plusieurs écrans, et recharge une fois par changement', async () => {
    let calls = 0;
    const query = async () => ++calls;
    const a = await renderHook(() => useSharedLiveQuery('k1', query, ['tasks']));
    const b = await renderHook(() => useSharedLiveQuery('k1', query, ['tasks']));
    await flush();
    expect(calls).toBe(1);
    expect(a.result.current.data).toBe(1);
    expect(b.result.current.data).toBe(1);

    await act(async () => notifyChange(['tasks']));
    await flush();
    expect(calls).toBe(2);
    expect(a.result.current.data).toBe(2);

    // Une table non écoutée ne recharge pas.
    await act(async () => notifyChange(['notes']));
    await flush();
    expect(calls).toBe(2);

    // Sans plus aucun abonné, les changements ne sont plus suivis ; le prochain abonné recharge.
    await a.unmount();
    await b.unmount();
    await act(async () => notifyChange(['tasks']));
    await flush();
    expect(calls).toBe(2);
    const c = await renderHook(() => useSharedLiveQuery('k1', query, ['tasks']));
    await flush();
    expect(calls).toBe(3);
    expect(c.result.current.data).toBe(3);
  });

  it('recharge au retour au premier plan après 60 s ou un changement de jour', async () => {
    const handlers: ((s: AppStateStatus) => void)[] = [];
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      handlers.push(handler as (s: AppStateStatus) => void);
      return { remove } as never;
    });
    const start = new Date(2026, 8, 23, 23, 59, 30);
    jest.useFakeTimers({ now: start, doNotFake: ['nextTick', 'queueMicrotask'] });
    try {
      let calls = 0;
      const query = async () => ++calls;
      const h = await renderHook(() =>
        useSharedLiveQuery('fg', query, ['tasks'], { refreshOn: 'foreground' }),
      );
      await flush();
      expect(calls).toBe(1);
      expect(handlers).toHaveLength(1);

      // Retour immédiat : rien (moins de 60 s, même jour).
      jest.setSystemTime(start.getTime() + 10_000);
      await act(async () => handlers[0]!('active'));
      await flush();
      expect(calls).toBe(1);

      // Retour après minuit (40 s plus tard, mais le jour a changé) : relecture.
      jest.setSystemTime(start.getTime() + 40_000);
      await act(async () => handlers[0]!('active'));
      await flush();
      expect(calls).toBe(2);
      expect(h.result.current.data).toBe(2);

      // Passage en arrière-plan : rien ; retour après plus de 60 s : relecture.
      jest.setSystemTime(start.getTime() + 40_000 + FOREGROUND_REFRESH_MS + 1);
      await act(async () => handlers[0]!('background'));
      await flush();
      expect(calls).toBe(2);
      await act(async () => handlers[0]!('active'));
      await flush();
      expect(calls).toBe(3);

      await h.unmount();
      expect(remove).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      spy.mockRestore();
    }
  });

  it('shouldRefreshOnForeground : lecture ancienne ou jour changé', () => {
    const at = new Date(2026, 8, 23, 10, 0);
    const fresh = { loadedAt: at.getTime(), loadedDay: '2026-09-23' };
    expect(shouldRefreshOnForeground(fresh, new Date(2026, 8, 23, 10, 0, 30))).toBe(false);
    expect(shouldRefreshOnForeground(fresh, new Date(2026, 8, 23, 10, 1))).toBe(true);
    expect(shouldRefreshOnForeground(fresh, new Date(2026, 8, 24, 0, 0, 10))).toBe(true);
  });

  it('garde les clés séparées', async () => {
    const one = await renderHook(() => useSharedLiveQuery('k2', async () => 'a', ['x']));
    const two = await renderHook(() => useSharedLiveQuery('k3', async () => 'b', ['x']));
    await flush();
    expect(one.result.current.data).toBe('a');
    expect(two.result.current.data).toBe('b');
  });
});
