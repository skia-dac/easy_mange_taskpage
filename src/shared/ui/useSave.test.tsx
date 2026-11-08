import { act, renderHook } from '@testing-library/react-native';

import { useSave } from './useSave';

jest.mock('./haptics', () => ({ haptic: jest.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useSave', () => {
  it('double appui dans la même image : un seul enregistrement, un seul retour', async () => {
    const { result } = await renderHook(() => useSave());
    const save = deferred<string>();
    const create = jest.fn(() => save.promise);
    const goBack = jest.fn();
    // Comme un formulaire : l'action enregistre puis revient en arrière.
    const submit = () =>
      result.current.run(async () => {
        const id = await create();
        goBack();
        return id;
      });

    let first!: Promise<string | undefined>;
    let second!: Promise<string | undefined>;
    // Deux appuis avant tout nouveau rendu (même `run`, état `saving` pas encore à jour).
    await act(async () => {
      first = submit();
      second = submit();
    });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();

    await act(async () => {
      save.resolve('note-1');
    });
    await expect(first).resolves.toBe('note-1');
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(result.current.saving).toBe(false);
  });

  it('après la fin (réussite ou échec), un nouvel enregistrement est possible', async () => {
    const { result } = await renderHook(() => useSave());
    await act(async () => {
      await result.current.run(() => Promise.reject(new Error('disk'))).catch(() => undefined);
    });
    const action = jest.fn(async () => 'ok');
    let value: string | undefined;
    await act(async () => {
      value = await result.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(value).toBe('ok');
  });
});
