import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { setLanguagePreference } from '@/modules/identity';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import {
  applyLanguagePreference,
  NOTIFICATIONS_TASK,
  NOTIFICATIONS_TASK_INTERVAL_MINUTES,
  registerNotificationsTask,
} from './backgroundTask';

jest.mock('expo-background-task', () => ({
  getStatusAsync: jest.fn(async () => 2),
  registerTaskAsync: jest.fn(async () => undefined),
  BackgroundTaskStatus: { Restricted: 1, Available: 2 },
  BackgroundTaskResult: { Success: 1, Failed: 2 },
}));
jest.mock('expo-task-manager', () => ({
  isTaskRegisteredAsync: jest.fn(async () => false),
  isTaskDefined: jest.fn(() => false),
  defineTask: jest.fn(),
}));

const register = jest.mocked(BackgroundTask.registerTaskAsync);
beforeEach(() => register.mockClear());

describe('tâche de fond des rappels', () => {
  it('demandée au plus une fois par jour (en minutes, minimum Android : 15)', async () => {
    expect(await registerNotificationsTask()).toBe(true);
    expect(register).toHaveBeenCalledWith(NOTIFICATIONS_TASK, { minimumInterval: 24 * 60 });
    expect(NOTIFICATIONS_TASK_INTERVAL_MINUTES).toBeGreaterThanOrEqual(15);
  });

  it('déjà enregistrée ou indisponible (simulateur, mode économie) : rien de plus', async () => {
    jest.mocked(TaskManager.isTaskRegisteredAsync).mockResolvedValueOnce(true);
    expect(await registerNotificationsTask()).toBe(true);
    jest.mocked(BackgroundTask.getStatusAsync).mockResolvedValueOnce(1);
    expect(await registerNotificationsTask()).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('les rappels sont écrits dans la langue choisie, même app fermée', async () => {
    const db = await createTestDb();
    await i18n.changeLanguage('fr');
    await setLanguagePreference(db, 'en');
    await applyLanguagePreference(db);
    expect(i18n.language).toBe('en');
    await setLanguagePreference(db, 'fr');
    await applyLanguagePreference(db);
    expect(i18n.language).toBe('fr');
    db.close();
  });
});
