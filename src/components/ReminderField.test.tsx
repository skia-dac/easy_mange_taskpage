import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import type { NotificationPermission } from '@/modules/platform';
import { i18n } from '@/shared/i18n';

import { ReminderField } from './ReminderField';

const mockPermission = {
  state: 'undetermined' as NotificationPermission,
  ensure: jest.fn(async () => true),
};
jest.mock('@/modules/platform', () => ({
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
}));

const flush = () => act(async () => {});

function Harness({ initial = null }: { initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <ReminderField dueDate="2026-10-10" value={value} onChange={setValue} />;
}

/** La boîte d'explication : on appuie sur le bouton dont le texte est donné. */
function answerAlert(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockPermission.ensure.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('rappel : la permission est demandée au bon moment', () => {
  it('premier rappel choisi : explication, puis demande du système', async () => {
    mockPermission.state = 'undetermined';
    mockPermission.ensure.mockImplementation(async () => {
      mockPermission.state = 'granted';
      return true;
    });
    const alert = answerAlert('Continuer');
    await render(<Harness />);
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      'Recevoir tes rappels ?',
      expect.stringContaining('notification'),
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockPermission.ensure).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('reminder-permission-off')).toBeNull();
  });

  it('explication refusée : le champ le dit, avec un bouton pour autoriser', async () => {
    mockPermission.state = 'undetermined';
    answerAlert('Annuler');
    await render(<Harness />);
    await fireEvent.press(screen.getByText('Le jour même à 09:00'));
    await flush();
    expect(mockPermission.ensure).not.toHaveBeenCalled();
    expect(screen.getByText('Les notifications sont désactivées : ce rappel ne sonnera pas.'));
    expect(screen.getByText('Autoriser les notifications')).toBeTruthy();
  });

  it('permission refusée dans le système : message et bouton vers les réglages', async () => {
    mockPermission.state = 'denied';
    const alert = jest.spyOn(Alert, 'alert');
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(<Harness initial="2026-10-09T17:00:00.000Z" />);
    await flush();
    expect(screen.getByTestId('reminder-permission-off')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir les réglages'));
    expect(settings).toHaveBeenCalled();
    // Rien n'est redemandé : seul le réglage du téléphone peut rendre la permission.
    expect(alert).not.toHaveBeenCalled();
  });

  it('permission déjà accordée : aucune question, aucun message', async () => {
    mockPermission.state = 'granted';
    const alert = jest.spyOn(Alert, 'alert');
    await render(<Harness />);
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    await flush();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reminder-permission-off')).toBeNull();
  });
});
