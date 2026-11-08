import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '../i18n';
import { CHOICE_ANDROID_DELAY_MS, CHOICE_IOS_FALLBACK_MS, ChoiceSheet } from './ChoiceSheet';

/**
 * Modal simulée : montre son contenu tant qu'elle est visible et garde `onDismiss`, que le test
 * appelle comme iOS le ferait une fois la fermeture terminée.
 */
const mockModal: { onDismiss?: () => void; visible?: boolean } = {};
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Modal(props: { visible: boolean; onDismiss?: () => void; children: ReactNode }) {
    mockModal.onDismiss = props.onDismiss;
    mockModal.visible = props.visible;
    return props.visible ? React.createElement(React.Fragment, null, props.children) : null;
  }
  return { __esModule: true, default: Modal };
});

jest.useFakeTimers();

function Harness({ action, afterDismiss = true }: { action: () => void; afterDismiss?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <ChoiceSheet
      visible={open}
      title="Se déconnecter"
      options={[
        { label: 'Effacer ce téléphone', destructive: true, afterDismiss, onPress: action },
      ]}
      onClose={() => setOpen(false)}
    />
  );
}

async function show(action: () => void, afterDismiss = true) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <Harness action={action} afterDismiss={afterDismiss} />
    </SafeAreaProvider>,
  );
}

const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
});
afterEach(() => jest.restoreAllMocks());

describe('ChoiceSheet : l’action part une fois la fenêtre fermée', () => {
  it('iPhone : attend onDismiss, puis lance l’action une seule fois', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const action = jest.fn();
    await show(action);
    await fireEvent.press(screen.getByText('Effacer ce téléphone'));
    // La fenêtre se ferme, mais l'action (ex. une confirmation) n'est pas encore présentée.
    expect(mockModal.visible).toBe(false);
    expect(action).not.toHaveBeenCalled();
    await act(async () => mockModal.onDismiss?.());
    expect(action).toHaveBeenCalledTimes(1);
    // Le filet de sécurité ne la relance pas.
    await wait(CHOICE_IOS_FALLBACK_MS);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('iPhone : sans onDismiss, le filet de sécurité lance l’action', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const action = jest.fn();
    await show(action);
    await fireEvent.press(screen.getByText('Effacer ce téléphone'));
    await wait(CHOICE_IOS_FALLBACK_MS - 1);
    expect(action).not.toHaveBeenCalled();
    await wait(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('Android : pas d’onDismiss, l’action part après le fondu de fermeture', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const action = jest.fn();
    await show(action);
    expect(mockModal.onDismiss).toBeUndefined();
    await fireEvent.press(screen.getByText('Effacer ce téléphone'));
    expect(action).not.toHaveBeenCalled();
    await wait(CHOICE_ANDROID_DELAY_MS);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('ChoiceSheet : une option sans afterDismiss part tout de suite', () => {
  it.each(['ios', 'android'] as const)('%s : action immédiate, une seule fois', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    const action = jest.fn();
    await show(action, false);
    await fireEvent.press(screen.getByText('Effacer ce téléphone'));
    expect(action).toHaveBeenCalledTimes(1);
    expect(mockModal.visible).toBe(false);
    await act(async () => mockModal.onDismiss?.());
    await wait(CHOICE_IOS_FALLBACK_MS);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('démontée pendant la fermeture : l’action en attente est annulée', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const action = jest.fn();
    await show(action);
    await fireEvent.press(screen.getByText('Effacer ce téléphone'));
    await act(async () => screen.unmount());
    await wait(CHOICE_IOS_FALLBACK_MS);
    expect(action).not.toHaveBeenCalled();
  });
});
