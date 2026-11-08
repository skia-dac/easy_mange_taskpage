import { act, renderHook } from '@testing-library/react-native';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { Alert } from 'react-native';

import { i18n } from '@/shared/i18n';

import { useDirty, useUnsavedGuard } from './useUnsavedGuard';

// `expo-router/react-navigation` est remplacé dans jest.setup.ts : on observe `usePreventRemove`.
const prevent = jest.mocked(usePreventRemove);
const action = { type: 'GO_BACK' };
type Callback = Parameters<typeof usePreventRemove>[1];

/** Le retrait de l'écran demandé par le système (retour, geste) avec la dernière garde posée. */
function tryToLeave() {
  const [, callback] = prevent.mock.calls.at(-1) as [boolean, Callback];
  callback({ data: { action } });
}

describe('garde « Abandonner les modifications ? »', () => {
  const alert = jest.spyOn(Alert, 'alert');
  const dispatch = useNavigation().dispatch as jest.Mock;

  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    prevent.mockClear();
    alert.mockReset();
    dispatch.mockClear();
  });

  it('ne bloque rien tant que le formulaire n’a pas changé', async () => {
    await renderHook(() => useUnsavedGuard(false));
    expect(prevent.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it('formulaire modifié : demande, « Continuer la saisie » reste sur l’écran', async () => {
    await renderHook(() => useUnsavedGuard(true));
    expect(prevent.mock.calls.at(-1)?.[0]).toBe(true);
    tryToLeave();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = alert.mock.calls[0]!;
    expect(title).toBe(i18n.t('unsaved.title'));
    expect(buttons?.map((b) => [b.text, b.style])).toEqual([
      ['Continuer la saisie', 'cancel'],
      ['Abandonner', 'destructive'],
    ]);
    await act(async () => buttons?.[0]?.onPress?.());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('« Abandonner » laisse partir l’écran', async () => {
    await renderHook(() => useUnsavedGuard(true));
    tryToLeave();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons[1]?.onPress?.());
    expect(dispatch).toHaveBeenCalledWith(action);
  });

  it('après un enregistrement, `leave` sort sans question', async () => {
    const { result } = await renderHook(() => useUnsavedGuard(true));
    const go = jest.fn(() => tryToLeave());
    await act(async () => result.current(go));
    expect(go).toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(action);
  });
});

describe('useDirty', () => {
  it('compare à l’état de départ, une fois prêt', async () => {
    const { result, rerender } = await renderHook(
      ({ value, ready }: { value: { title: string }; ready: boolean }) => useDirty(value, ready),
      { initialProps: { value: { title: '' }, ready: false } },
    );
    expect(result.current.dirty).toBe(false);
    // Fiche chargée : c'est l'état de départ, pas une modification.
    await rerender({ value: { title: 'Lire' }, ready: true });
    expect(result.current.dirty).toBe(false);
    await rerender({ value: { title: 'Lire le chapitre 2' }, ready: true });
    expect(result.current.dirty).toBe(true);
    await rerender({ value: { title: 'Lire' }, ready: true });
    expect(result.current.dirty).toBe(false);
  });

  it('`markClean` remplace l’état de départ (fiche chargée de la base)', async () => {
    const { result, rerender } = await renderHook(
      ({ value }: { value: { title: string } }) => useDirty(value),
      {
        initialProps: { value: { title: '' } },
      },
    );
    await act(async () => result.current.markClean({ title: 'Chargée' }));
    await rerender({ value: { title: 'Chargée' } });
    expect(result.current.dirty).toBe(false);
  });
});
