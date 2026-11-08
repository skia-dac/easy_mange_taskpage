/**
 * Cocher une habitude propose « Annuler », comme terminer une tâche ou faire +1 : la journée
 * revient exactement comme avant (rien de noté, ou « pas fait » avec sa raison).
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  createHabit,
  getHabit,
  listHabitLogs,
  restoreHabitDay,
  setHabitDone,
  setHabitMissed,
  type Habit,
  type HabitLog,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { ToastHost } from '@/shared/ui';
import { createTestDb } from '@/test/memoryDb';

import { HabitRow } from './HabitRow';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useSegments: () => ['(tabs)'] }));

const DAY = '2026-09-23';
const flush = () => act(async () => {});
const logOf = async (habitId: string) => (await listHabitLogs(mockDb, DAY, DAY, habitId))[0];

beforeEach(async () => {
  mockDb = await createTestDb();
  await i18n.changeLanguage('fr');
});
afterEach(() => mockDb.close());

describe('annuler une habitude cochée', () => {
  it('restoreHabitDay : rien de noté avant → la journée redevient vide', async () => {
    const id = await createHabit(mockDb, { name: 'Lire' });
    await setHabitDone(mockDb, id, DAY, true);
    await restoreHabitDay(mockDb, id, DAY, null);
    expect(await logOf(id)).toBeUndefined();
  });

  it('restoreHabitDay : « pas fait » avec sa raison revient tel quel', async () => {
    const id = await createHabit(mockDb, { name: 'Sport' });
    await setHabitMissed(mockDb, id, DAY, 'missed', 'tired', 'Grosse journée');
    const before = (await logOf(id)) as HabitLog;
    await setHabitDone(mockDb, id, DAY, true);
    expect((await logOf(id))?.status).toBe('done');
    await restoreHabitDay(mockDb, id, DAY, before);
    expect(await logOf(id)).toMatchObject({
      status: 'missed',
      reasonCode: 'tired',
      reason: 'Grosse journée',
      count: 0,
    });
  });

  it('la case de la ligne : cocher puis « Annuler » dans le message', async () => {
    const id = await createHabit(mockDb, { name: 'Méditer' });
    const habit = (await getHabit(mockDb, id)) as Habit;
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <HabitRow habit={habit} logs={[]} day={DAY} today={DAY} weekStart={1} onMore={() => {}} />
        <ToastHost />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Méditer' }));
    await flush();
    expect((await logOf(id))?.status).toBe('done');
    expect(screen.getByText(i18n.t('habits.doneToast', { name: 'Méditer' }))).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t('toast.undo')));
    await flush();
    expect(await logOf(id)).toBeUndefined();
  });
});
