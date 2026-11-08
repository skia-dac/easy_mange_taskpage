import * as Notifications from 'expo-notifications';

import { defaultNotificationPreferences, setNotificationPreferences } from '@/modules/identity';
import type { WorkItem } from '@/modules/productivity';
import type { TodayData } from '@/projections';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { planReminders } from './plan';
import {
  cancelAllReminders,
  planKey,
  resetScheduledPlan,
  syncScheduledNotifications,
} from './scheduler';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { HIGH: 4 },
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  clearLastNotificationResponseAsync: jest.fn(),
}));

const cancel = jest.mocked(Notifications.cancelAllScheduledNotificationsAsync);
const schedule = jest.mocked(Notifications.scheduleNotificationAsync);
const now = new Date(2026, 8, 23, 8, 0);

const task: WorkItem = {
  id: 'w1',
  kind: 'task',
  title: 'Rendre le rapport',
  description: null,
  subjectId: null,
  dueDate: '2026-09-29',
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  reminderAt: new Date(2026, 8, 28, 18, 0).toISOString(),
  repeat: 'none',
  estimatedMinutes: null,
  space: 'personal',
};
/** Ce que le planificateur lit ; le reste de l'agenda (dépenses, humeurs…) n'y change rien. */
const agenda = (work: WorkItem[], extra: Record<string, unknown> = {}) =>
  ({ series: [], exams: [], work, events: [], ...extra }) as unknown as TodayData;

let db: Db & { close(): void };
beforeAll(async () => {
  await i18n.changeLanguage('fr');
  db = await createTestDb();
  await setNotificationPreferences(db, { ...defaultNotificationPreferences, eveningReview: false });
});
afterAll(() => db.close());
beforeEach(() => {
  resetScheduledPlan();
  cancel.mockClear();
  schedule.mockClear();
});

describe('reprogrammer seulement quand le plan change', () => {
  it('même plan (ex. une dépense ajoutée) : rien n’est annulé ni reprogrammé', async () => {
    expect(await syncScheduledNotifications(db, agenda([task]), now)).toBe(1);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    // Nouvel objet agenda, mêmes rappels : une dépense ou une humeur ne compte pas.
    await syncScheduledNotifications(db, agenda([{ ...task }], { moods: [{ id: 'm' }] }), now);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it('rappel déplacé : tout est reprogrammé', async () => {
    await syncScheduledNotifications(db, agenda([task]), now);
    const moved = { ...task, reminderAt: new Date(2026, 8, 27, 9, 0).toISOString() };
    await syncScheduledNotifications(db, agenda([moved]), now);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('réglages du son changés : reprogrammé (canal Android différent)', async () => {
    await syncScheduledNotifications(db, agenda([task]), now);
    await setNotificationPreferences(db, {
      ...defaultNotificationPreferences,
      eveningReview: false,
      sound: false,
    });
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(cancel).toHaveBeenCalledTimes(2);
    await setNotificationPreferences(db, {
      ...defaultNotificationPreferences,
      eveningReview: false,
    });
  });

  it('après « tout annuler » (suppression des données), le plan est reprogrammé', async () => {
    await syncScheduledNotifications(db, agenda([task]), now);
    await cancelAllReminders();
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('l’empreinte change avec la langue des textes', () => {
    const prefs = defaultNotificationPreferences;
    const plan = planReminders(agenda([task]), prefs, now, { subjectName: () => '' });
    expect(planKey(plan, prefs, 'fr')).toBe(planKey([...plan], prefs, 'fr'));
    expect(planKey(plan, prefs, 'fr')).not.toBe(planKey(plan, prefs, 'en'));
  });
});
