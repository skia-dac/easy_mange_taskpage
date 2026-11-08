import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '../i18n';
import { FAB_CLEARANCE } from './PlusButton';
import { SCREEN_READER_SHOW_MS, showToast, showUndoToast, ToastHost } from './Toast';

jest.mock('expo-router', () => ({ useSegments: () => ['(tabs)'] }));

const Host = () => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <ToastHost />
  </SafeAreaProvider>
);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('affiche le message puis le retire tout seul', async () => {
    await render(<Host />);
    await act(async () => showToast('Terminé : Maths'));
    expect(screen.getByText('Terminé : Maths')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(4000));
    expect(screen.queryByText('Terminé : Maths')).toBeNull();
  });

  it('« Annuler » lance l’action inverse et ferme le message', async () => {
    await render(<Host />);
    const undo = jest.fn();
    await act(async () => showUndoToast('Reporté au 26/09', undo));
    await act(async () => fireEvent.press(screen.getByText(i18n.t('toast.undo'))));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Reporté au 26/09')).toBeNull();
  });

  it('sans hôte monté, showToast ne plante pas', () => {
    expect(() => showToast('rien')).not.toThrow();
  });

  it('se pose au-dessus du bouton + et de la barre d’onglets', async () => {
    await render(<Host />);
    await act(async () => showUndoToast('Terminé : Maths', () => {}));
    let node = screen.getByTestId('toast').parent;
    let bottom: number | undefined;
    while (node && bottom === undefined) {
      const style = StyleSheet.flatten(node.props.style) as { bottom?: number } | undefined;
      bottom = style?.bottom;
      node = node.parent;
    }
    // Barre pas encore mesurée : sa hauteur par défaut (56), plus la place du bouton +.
    expect(bottom).toBe(56 + FAB_CLEARANCE);
  });
});

describe('Toast avec un lecteur d’écran', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('un message avec « Annuler » ne part pas tout seul, et « Fermer » le retire', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Host />);
    await act(async () => showUndoToast('Terminé : Maths', () => {}));
    expect(announce).toHaveBeenCalledWith(`Terminé : Maths ${i18n.t('toast.undo')}`);
    await act(async () => jest.advanceTimersByTime(60000));
    expect(screen.getByText('Terminé : Maths')).toBeTruthy();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: i18n.t('common.close') })),
    );
    expect(screen.queryByText('Terminé : Maths')).toBeNull();
  });

  it('un message seul reste au moins 20 secondes', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await act(async () => jest.advanceTimersByTime(SCREEN_READER_SHOW_MS - 1000));
    expect(screen.getByText('Enregistré')).toBeTruthy();
    expect(SCREEN_READER_SHOW_MS).toBeGreaterThanOrEqual(20000);
    await act(async () => jest.advanceTimersByTime(2000));
    expect(screen.queryByText('Enregistré')).toBeNull();
  });
});
