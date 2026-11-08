import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createWorkItem, getWorkItem, type WorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { canPostpone, usePostpone } from './PostponeSheet';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) }); // mercredi 23 sept. 2026

const flush = () => act(async () => {});

function Harness({ item }: { item: WorkItem }) {
  const postpone = usePostpone();
  const { open } = postpone;
  useEffect(() => open(item), [open, item]);
  return postpone.sheet;
}

async function show(item: WorkItem) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <Harness item={item} />
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
  await flush();
}

async function task(dueDate: string | null) {
  const id = await createWorkItem(mockDb, 'task', {
    title: `Tâche ${dueDate ?? 'sans date'}`,
    dueDate,
    priority: 'normal',
    status: 'todo',
  });
  return (await getWorkItem(mockDb, 'task', id))!;
}

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

describe('menu « Reporter »', () => {
  it('« Reporter » n’existe pas pour une tâche sans date ou terminée', () => {
    expect(canPostpone({ dueDate: null, status: 'todo' })).toBe(false);
    expect(canPostpone({ dueDate: '2026-09-23', status: 'done' })).toBe(false);
    expect(canPostpone({ dueDate: '2026-09-23', status: 'todo' })).toBe(true);
  });

  it('tâche sans date : le menu ne s’ouvre pas', async () => {
    await show(await task(null));
    expect(screen.queryByText(i18n.t('postpone.title'))).toBeNull();
  });

  it('échéance à venir : demain, 2 jours, lundi, autre date, retirer la date (pas « Aujourd’hui »)', async () => {
    await show(await task('2026-09-24'));
    expect(screen.getByText(i18n.t('postpone.title'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('postpone.today'))).toBeNull();
    expect(screen.getByText(i18n.t('postpone.tomorrow'))).toBeTruthy();
    expect(screen.getByText(i18n.t('postpone.removeDate'))).toBeTruthy();
  });

  it('en retard : « Aujourd’hui » ramène la tâche à aujourd’hui', async () => {
    const late = await task('2026-09-20');
    await show(late);
    await fireEvent.press(screen.getByText(i18n.t('postpone.today')));
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await flush();
    expect((await getWorkItem(mockDb, 'task', late.id))?.dueDate).toBe('2026-09-23');
  });

  it('« Retirer la date » : la tâche passe « Sans date »', async () => {
    const dated = await task('2026-09-25');
    await show(dated);
    await fireEvent.press(screen.getByText(i18n.t('postpone.removeDate')));
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    await flush();
    expect((await getWorkItem(mockDb, 'task', dated.id))?.dueDate).toBeNull();
  });
});
