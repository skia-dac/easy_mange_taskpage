import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { notifyChange, type Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { showToast } from '@/shared/ui';
import { createTestDb } from '@/test/memoryDb';

import { ConflictsGate } from './ConflictsGate';
import { ProfileButton } from './ProfileButton';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/shared/ui', () => ({ ...jest.requireActual('@/shared/ui'), showToast: jest.fn() }));

const toast = jest.mocked(showToast);
const flush = () => act(async () => {});
let n = 0;

/** Une synchronisation garde une modification locale en conflit. */
async function addConflict() {
  n += 1;
  await mockDb.runAsync(
    `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at)
     VALUES (?, 'tasks', ?, '{}', '{}', '2026-09-24T08:00:00.000Z')`,
    [`c${n}`, `t${n}`],
  );
  await act(async () => notifyChange(['sync_conflicts']));
  await flush();
}

const inApp = (ui: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {ui}
  </SafeAreaProvider>
);

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  toast.mockClear();
  jest.mocked(router.push).mockClear();
});
afterEach(() => mockDb.close());

describe('conflits de synchronisation visibles', () => {
  it('nouveaux conflits : un message une seule fois, avec « Voir » vers les conflits', async () => {
    await render(<ConflictsGate />);
    await flush();
    expect(toast).not.toHaveBeenCalled();
    await addConflict();
    expect(toast).toHaveBeenCalledTimes(1);
    const [message, action] = toast.mock.calls[0]!;
    expect(message).toBe('Un conflit de synchronisation est à régler.');
    expect(action?.label).toBe('Voir');
    action?.onPress();
    expect(router.push).toHaveBeenCalledWith('/account/conflicts');
    // Relecture sans nouveau conflit : pas de second message.
    await act(async () => notifyChange(['sync_conflicts']));
    await flush();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('conflits déjà là à l’ouverture : pas de message (le badge les rappelle)', async () => {
    await addConflict();
    await render(<ConflictsGate />);
    await flush();
    expect(toast).not.toHaveBeenCalled();
  });

  it('badge sur la photo du profil, annoncé au lecteur d’écran', async () => {
    await render(inApp(<ProfileButton />));
    await flush();
    const hidden = { includeHiddenElements: true };
    expect(screen.queryByTestId('conflict-badge', hidden)).toBeNull();
    await addConflict();
    await addConflict();
    // La pastille est visuelle ; le lecteur d'écran entend le nombre dans le libellé du bouton.
    expect(screen.getByTestId('conflict-badge', hidden)).toBeTruthy();
    expect(screen.getByText('2', hidden)).toBeTruthy();
    const button = screen.getByLabelText('Profil, 2 conflits à régler');
    await fireEvent.press(button);
    expect(router.push).toHaveBeenCalledWith('/profile');
  });
});
