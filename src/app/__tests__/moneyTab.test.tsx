/**
 * Onglet Argent : « À payer » regroupe les échéances d'une même charge ou tontine, la carte
 * principale signale un découvert, et le libellé de la période est court.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createRecurring, createTransaction } from '@/modules/finance';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import MoneyRoute from '../(tabs)/money';

let mockDb: Db & { close(): void };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => {},
  Stack: { Screen: () => null },
}));

// Mercredi 23 septembre 2026 : période de septembre (mois qui commence le 1er, par défaut).
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const show = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <MoneyRoute />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );

const tontine = () =>
  createRecurring(mockDb, {
    kind: 'tontine',
    name: 'Tontine des amis de la fac',
    amountMinor: 5000,
    currency: 'XAF',
    frequency: 'weekly',
    weekday: 6,
    startDate: '2026-09-01',
    reminders: [],
  });

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterEach(() => mockDb.close());

describe('onglet Argent', () => {
  it('une seule ligne pour les 4 cotisations de la tontine, en retard en tête', async () => {
    await tontine();
    await createRecurring(mockDb, {
      kind: 'charge',
      name: 'Loyer',
      categoryId: 'home',
      amountMinor: 35000,
      currency: 'XAF',
      frequency: 'monthly',
      dayOfMonth: 28,
      startDate: '2026-09-01',
      reminders: [],
    });
    await createTransaction(mockDb, {
      kind: 'income',
      amountMinor: 100000,
      currency: 'XAF',
      date: '2026-09-01',
      categoryId: 'family_in',
    });
    await show();

    expect(await screen.findAllByText('Tontine des amis de la fac')).toHaveLength(1);
    expect(screen.getByText(/^4 × 5\s000 · prochaine sam\. 5 sept\.$/)).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByText('Loyer')).toBeTruthy();
    // Une case par ligne, avec le libellé d'avant.
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(screen.getByLabelText('Marquer Tontine des amis de la fac comme payé')).toBeTruthy();
    // En retard d'abord : la tontine (5 sept.) avant le loyer (28 sept.).
    expect(boxes[0]?.props.accessibilityLabel).toBe(
      'Marquer Tontine des amis de la fac comme payé',
    );

    // Cocher paie la prochaine échéance : 1 sur 4 payée, la ligne reste là.
    await fireEvent.press(screen.getByLabelText('Marquer Tontine des amis de la fac comme payé'));
    // Le 12 sept. est passé aussi : toujours « En retard », l'avancée passe dans le sous-titre.
    expect(
      await screen.findByText(/^4 × 5\s000 · prochaine sam\. 12 sept\. · Payé 1\/4$/),
    ).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByLabelText('Marquer Tontine des amis de la fac comme payé')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: false }),
    );
  }, 20_000);

  it('au-delà de 6 lignes : « Voir tout » ouvre les charges fixes', async () => {
    for (const name of ['Eau', 'Électricité', 'Internet', 'Loyer', 'Gaz', 'Transport', 'Forfait'])
      await createRecurring(mockDb, {
        kind: 'charge',
        name,
        amountMinor: 1000,
        currency: 'XAF',
        frequency: 'monthly',
        dayOfMonth: 28,
        startDate: '2026-09-01',
        reminders: [],
      });
    await show();

    expect(await screen.findByText('Voir tout (1 de plus)')).toBeTruthy();
    expect(screen.getAllByRole('checkbox')).toHaveLength(6);
    await fireEvent.press(screen.getByText('Voir tout (1 de plus)'));
    expect(
      jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router.push,
    ).toHaveBeenCalledWith('/money/recurring');
  }, 20_000);

  it('solde négatif : la carte le dit, sans barre trompeuse', async () => {
    await createTransaction(mockDb, {
      kind: 'income',
      amountMinor: 10000,
      currency: 'XAF',
      date: '2026-09-02',
      categoryId: 'family_in',
    });
    await createTransaction(mockDb, {
      kind: 'expense',
      amountMinor: 34000,
      currency: 'XAF',
      date: '2026-09-10',
      categoryId: 'food',
    });
    await show();
    await act(async () => {});

    expect(await screen.findByTestId('money-hero-deficit')).toBeTruthy();
    expect(screen.getByText(/^Tu es à découvert de 24\s000 FCFA$/)).toBeTruthy();
    expect(screen.getByText('IL TE RESTE')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  }, 20_000);

  it('solde positif : barre de ce qui reste, et pas de ligne de report à 0', async () => {
    await createTransaction(mockDb, {
      kind: 'income',
      amountMinor: 100000,
      currency: 'XAF',
      date: '2026-09-02',
      categoryId: 'family_in',
    });
    await createTransaction(mockDb, {
      kind: 'expense',
      amountMinor: 40000,
      currency: 'XAF',
      date: '2026-09-10',
      categoryId: 'food',
    });
    await show();

    expect(await screen.findByTestId('money-hero')).toBeTruthy();
    // Texte visible (caché au lecteur d'écran, qui lit la même phrase comme valeur de la barre).
    expect(
      screen.getByText(/^60 % restant sur 100\s000 FCFA$/, { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toMatchObject({ now: 60 });
    expect(screen.queryByText(/Report de la période précédente/)).toBeNull();
  }, 20_000);

  it('période : « Septembre 2026 », et « Aujourd’hui » pour revenir', async () => {
    await createTransaction(mockDb, {
      kind: 'expense',
      amountMinor: 1500,
      currency: 'XAF',
      date: '2026-09-23',
      categoryId: 'food',
    });
    await show();

    expect(await screen.findByText('Septembre 2026')).toBeTruthy();
    expect(
      screen.getByLabelText('Période : Septembre 2026. Du mar. 1 sept. au mer. 30 sept.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Revenir à la période en cours')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Précédent'));
    expect(await screen.findByText('Août 2026')).toBeTruthy();
    // Août : solde de fin de période, pas un « il restait » ambigu ; aucune opération.
    expect(screen.getByText('SOLDE FIN DE PÉRIODE')).toBeTruthy();
    expect(screen.getByText('Rien n’a été noté pendant cette période.')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Revenir à la période en cours'));
    expect(await screen.findByText('Septembre 2026')).toBeTruthy();
    await act(async () => {});
    expect(screen.queryByLabelText('Revenir à la période en cours')).toBeNull();
  }, 20_000);
});
