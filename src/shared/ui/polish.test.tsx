import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Alert, Dimensions } from 'react-native';

import { i18n } from '../i18n';
import { Checkbox } from './Checkbox';
import { confirmDestructive } from './dialogs';
import { ListRow } from './ListRow';
import { Segmented } from './Segmented';
import { StateView } from './StateView';
import { Toggle } from './Toggle';
import { useSave } from './useSave';

const mocked = Haptics as jest.Mocked<typeof Haptics>;

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('fr');
});

describe('retours tactiles', () => {
  it('segment : un toucher sur un autre choix, jamais sur celui déjà choisi', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        accessibilityLabel="Vue"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'À faire' },
          { value: 'b', label: 'Notes' },
        ]}
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'À faire' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(mocked.selectionAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('tab', { name: 'Notes' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(mocked.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('case à cocher : un léger choc pour terminer, rien pour décocher', async () => {
    const onToggle = jest.fn();
    const { rerender } = await render(
      <Checkbox checked={false} onToggle={onToggle} accessibilityLabel="Réviser" />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Réviser' }));
    expect(mocked.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    await rerender(<Checkbox checked onToggle={onToggle} accessibilityLabel="Réviser" />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Réviser' }));
    expect(mocked.impactAsync).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('interrupteur : un toucher à chaque bascule', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle accessibilityLabel="Rappels" value={false} onValueChange={onValueChange} />,
    );
    await fireEvent(screen.getByLabelText('Rappels'), 'valueChange', true);
    expect(mocked.selectionAsync).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('enregistrement réussi : une confirmation tactile ; échec : aucune', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { result } = await renderHook(() => useSave());
    await act(async () => {
      await result.current.run(async () => 'ok');
    });
    expect(mocked.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    mocked.notificationAsync.mockClear();
    await act(async () => {
      await result.current.run(async () => {
        throw new Error('disque plein');
      });
    });
    expect(mocked.notificationAsync).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('suppression : un avertissement avant la question', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    void confirmDestructive('Supprimer ?', 'Définitif.', 'Supprimer');
    expect(mocked.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
    expect(alert).toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe('très grand texte', () => {
  // Le téléphone de test annonce un texte à 200 % : on choisit la taille pour chaque cas.
  function withFontScale(fontScale: number) {
    const before = Dimensions.get('window');
    Dimensions.set({ window: { ...before, fontScale }, screen: { ...before, fontScale } });
    return { mockRestore: () => Dimensions.set({ window: before, screen: before }) };
  }

  it('taille normale : titre limité à deux lignes', async () => {
    const spy = withFontScale(1);
    await render(<ListRow title="Exposé d’histoire" subtitle="Demain" />);
    expect(screen.getByText('Exposé d’histoire').props.numberOfLines).toBe(2);
    spy.mockRestore();
  });

  it('à 200 % : rien n’est coupé', async () => {
    const spy = withFontScale(2);
    await render(<ListRow title="Exposé d’histoire" subtitle="Demain" />);
    expect(screen.getByText('Exposé d’histoire').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Demain').props.numberOfLines).toBeUndefined();
    spy.mockRestore();
  });

  it('le texte courant suit le réglage jusqu’à 200 %, les grands titres plafonnent', async () => {
    await render(<ListRow title="Titre" />);
    expect(screen.getByText('Titre').props.maxFontSizeMultiplier).toBe(2);
  });
});

describe('lignes fantômes', () => {
  it('autant de lignes que demandé, à la hauteur d’une vraie ligne', async () => {
    await render(<StateView state="loading" rows={4} />);
    const rows = screen.getAllByTestId('state-loading-row', { includeHiddenElements: true });
    expect(rows).toHaveLength(4);
    expect(rows[0]?.props.style).toMatchObject({ minHeight: 52 });
  });
});
