import { act, renderHook } from '@testing-library/react-native';

import { notifyChange } from './changes';
import type { Db } from './types';
import { useSharedLiveQuery } from './useSharedLiveQuery';

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

  it('garde les clés séparées', async () => {
    const one = await renderHook(() => useSharedLiveQuery('k2', async () => 'a', ['x']));
    const two = await renderHook(() => useSharedLiveQuery('k3', async () => 'b', ['x']));
    await flush();
    expect(one.result.current.data).toBe('a');
    expect(two.result.current.data).toBe('b');
  });
});
