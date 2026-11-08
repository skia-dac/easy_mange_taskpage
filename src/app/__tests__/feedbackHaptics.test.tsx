import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { haptic } from '@/shared/ui/haptics';
import { createTestDb } from '@/test/memoryDb';

import FeedbackScreen from '../feedback/index';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Stack: { Screen: () => null },
}));
jest.mock('@/shared/ui/haptics', () => ({ haptic: jest.fn() }));
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  getSupabase: () => null,
  useAuth: () => ({ email: null }),
}));
// Résultat de l'envoi : la messagerie s'ouvre (`sent`) ou aucune ne s'ouvre (`mailFailed`).
const mockOutcome = { value: 'sent' as 'sent' | 'mailFailed' };
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  submitFeedback: async () => ({ outcome: mockOutcome.value }),
}));

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

const flush = () => act(async () => {});

async function sendFeedback() {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <FeedbackScreen />
    </SafeAreaProvider>,
  );
  await flush();
  await fireEvent.press(screen.getByRole('radio', { name: /^Un problème/ }));
  await fireEvent.changeText(
    screen.getByPlaceholderText(i18n.t('feedback.placeholder.bug')),
    'Le bouton ne répond plus du tout.',
  );
  await fireEvent.press(screen.getByText(i18n.t('feedback.sendByMail')));
  for (let i = 0; i < 3; i++) await flush();
}

describe('« Donner mon avis » : le retour tactile dit la vérité', () => {
  beforeEach(() => jest.mocked(haptic).mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('aucune messagerie ouverte : message d’erreur, pas de vibration « réussi »', async () => {
    mockOutcome.value = 'mailFailed';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await sendFeedback();
    expect(alert).toHaveBeenCalledWith(i18n.t('errors.title'), i18n.t('feedback.mailFailed'));
    expect(haptic).not.toHaveBeenCalledWith('success');
  });

  it('messagerie ouverte : vibration « réussi »', async () => {
    mockOutcome.value = 'sent';
    await sendFeedback();
    expect(haptic).toHaveBeenCalledWith('success');
  });
});
