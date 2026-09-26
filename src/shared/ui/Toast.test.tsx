import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '../i18n';
import { showToast, showUndoToast, ToastHost } from './Toast';

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
});
