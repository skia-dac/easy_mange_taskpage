import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useAccountBackup } from '@/hooks/useAccountBackup';
import { i18n } from '@/shared/i18n';
import { showError, showToast } from '@/shared/ui';

import { AccountReminderCard } from '../today/AccountReminderCard';
import { AccountBackupCard } from './AccountBackupCard';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/hooks/useAccountBackup', () => ({ useAccountBackup: jest.fn() }));
jest.mock('@/shared/ui', () => ({
  ...jest.requireActual('@/shared/ui'),
  showToast: jest.fn(),
  showError: jest.fn(),
}));

type State = ReturnType<typeof useAccountBackup>;
const hook = jest.mocked(useAccountBackup);
const state = (patch: Partial<State>): State => ({
  mode: 'signedOut',
  lastSyncAt: null,
  pending: 0,
  syncing: false,
  showReminder: false,
  saveNow: jest.fn(),
  snooze: jest.fn(() => Promise.resolve()),
  ...patch,
});

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  jest.mocked(router.push).mockClear();
  jest.mocked(showToast).mockClear();
  jest.mocked(showError).mockClear();
});

describe('Réglages › Mes données : carte de sauvegarde', () => {
  it('sans compte : dit le risque et propose de créer un compte ou de se connecter', async () => {
    hook.mockReturnValue(state({ mode: 'signedOut' }));
    await render(<AccountBackupCard />);
    expect(screen.getByText(/tu ne pourras pas les récupérer/)).toBeTruthy();
    await fireEvent.press(screen.getByText('Créer un compte'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-up');
    await fireEvent.press(screen.getByText('Se connecter'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('comptes indisponibles : le dit, sans boutons morts', async () => {
    hook.mockReturnValue(state({ mode: 'unavailable' }));
    await render(<AccountBackupCard />);
    expect(screen.getByText(/pas encore disponibles dans cette version/)).toBeTruthy();
    expect(screen.queryByText('Créer un compte')).toBeNull();
    expect(screen.queryByText('Se connecter')).toBeNull();
  });

  it('avec un compte : sauvegardé, modifications en attente, « Sauvegarder maintenant » réussi', async () => {
    const saveNow = jest.fn(() =>
      Promise.resolve({ kind: 'saved' as const, at: '2026-11-08T10:00:00.000Z', pending: 0 }),
    );
    hook.mockReturnValue(
      state({ mode: 'account', lastSyncAt: '2026-11-08T09:00:00.000Z', pending: 2, saveNow }),
    );
    await render(<AccountBackupCard />);
    expect(screen.getByText('Tes données sont sauvegardées sur ton compte')).toBeTruthy();
    expect(screen.getByText(/Dernière sauvegarde/)).toBeTruthy();
    expect(screen.getByText('2 modifications à envoyer')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByText('Sauvegarder maintenant')));
    expect(saveNow).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Sauvegardé' }),
      expect.objectContaining({ tone: 'success' }),
    );
  });

  it('hors ligne : dit que la sauvegarde se fera à la connexion', async () => {
    const saveNow = jest.fn(() => Promise.resolve({ kind: 'offline' as const }));
    hook.mockReturnValue(state({ mode: 'account', saveNow }));
    await render(<AccountBackupCard />);
    await act(async () => fireEvent.press(screen.getByText('Sauvegarder maintenant')));
    expect(showToast).toHaveBeenCalledWith(
      'Pas de connexion. La sauvegarde se fera dès que tu seras connecté.',
    );
  });

  it('pendant une synchronisation, le bouton montre la progression et ne relance pas', async () => {
    const saveNow = jest.fn();
    hook.mockReturnValue(state({ mode: 'account', syncing: true, saveNow }));
    await render(<AccountBackupCard />);
    const buttons = screen.getAllByText('Sauvegarde en cours…');
    await fireEvent.press(buttons[buttons.length - 1]!);
    expect(saveNow).not.toHaveBeenCalled();
  });
});

describe('Aujourd’hui : carte « Crée un compte »', () => {
  it('ne s’affiche pas quand la règle le refuse', async () => {
    hook.mockReturnValue(state({ showReminder: false }));
    await render(<AccountReminderCard />);
    expect(screen.queryByText('Crée un compte pour ne jamais perdre tes données')).toBeNull();
  });

  it('« Créer un compte » ouvre l’inscription, « Plus tard » la met en pause', async () => {
    const snooze = jest.fn(() => Promise.resolve());
    hook.mockReturnValue(state({ showReminder: true, snooze }));
    await render(<AccountReminderCard />);
    expect(screen.getByText('Crée un compte pour ne jamais perdre tes données')).toBeTruthy();
    await fireEvent.press(screen.getByText('Créer un compte'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-up');
    await fireEvent.press(screen.getByText('Plus tard'));
    expect(snooze).toHaveBeenCalledTimes(1);
  });
});
