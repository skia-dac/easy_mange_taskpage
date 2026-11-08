import { act, renderHook } from '@testing-library/react-native';

import { useEditLoad } from './useEditLoad';

const flush = () => act(async () => {});

describe('useEditLoad : la fiche est lue avant d’afficher le formulaire', () => {
  it('création (pas d’id) : prêt tout de suite, rien n’est lu', async () => {
    const loader = jest.fn(async () => ({ title: 'x' }));
    const loaded = jest.fn();
    const { result } = await renderHook(() => useEditLoad(undefined, loader, loaded));
    expect(result.current.state).toBe('ready');
    await flush();
    expect(loader).not.toHaveBeenCalled();
    expect(loaded).not.toHaveBeenCalled();
  });

  it('modification : « loading », puis la fiche est donnée avant « ready »', async () => {
    let resolve: (v: { title: string }) => void = () => undefined;
    const loader = jest.fn(() => new Promise<{ title: string }>((r) => (resolve = r)));
    const seen: string[] = [];
    const { result } = await renderHook(() =>
      useEditLoad('t1', loader, (item) => seen.push(item.title)),
    );
    expect(result.current.state).toBe('loading');
    expect(loader).toHaveBeenCalledWith('t1');
    await act(async () => resolve({ title: 'Lire le chapitre 2' }));
    expect(seen).toEqual(['Lire le chapitre 2']);
    expect(result.current.state).toBe('ready');
  });

  it('fiche absente : « missing » (jamais un formulaire vide)', async () => {
    const loaded = jest.fn();
    const { result } = await renderHook(() => useEditLoad('disparu', async () => null, loaded));
    await flush();
    expect(result.current.state).toBe('missing');
    expect(loaded).not.toHaveBeenCalled();
  });

  it('lecture ratée : « error », puis « Réessayer » relit et réussit', async () => {
    const loader = jest
      .fn<Promise<{ title: string }>, [string]>()
      .mockRejectedValueOnce(new Error('disk'))
      .mockResolvedValueOnce({ title: 'Relue' });
    const loaded = jest.fn();
    const { result } = await renderHook(() => useEditLoad('t1', loader, loaded));
    await flush();
    expect(result.current.state).toBe('error');
    expect(loaded).not.toHaveBeenCalled();
    await act(async () => result.current.retry());
    await flush();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loaded).toHaveBeenCalledWith({ title: 'Relue' });
    expect(result.current.state).toBe('ready');
  });

  it('une lecture lente ne remplit pas le formulaire après la suivante (relance)', async () => {
    const resolvers: ((v: { title: string }) => void)[] = [];
    const loader = jest.fn(() => new Promise<{ title: string }>((r) => resolvers.push(r)));
    const loaded = jest.fn();
    const { rerender } = await renderHook(
      ({ id }: { id: string }) => useEditLoad(id, loader, loaded),
      {
        initialProps: { id: 'a' },
      },
    );
    await rerender({ id: 'b' });
    await act(async () => resolvers[0]?.({ title: 'A, trop tard' }));
    expect(loaded).not.toHaveBeenCalled();
    await act(async () => resolvers[1]?.({ title: 'B' }));
    expect(loaded).toHaveBeenCalledWith({ title: 'B' });
  });
});
