import * as Notifications from 'expo-notifications';

import { defaultNotificationPreferences, setNotificationPreferences } from '@/modules/identity';
import type { WorkItem } from '@/modules/productivity';
import type { TodayData } from '@/projections';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { planReminders } from './plan';
import { getReminderRunStatus, getReviewIntroDate } from './status';
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

describe('reprogrammations qui se chevauchent', () => {
  /** Notifications « programmées sur le téléphone » : ce que les appels laissent vraiment. */
  let store: Map<string, number>;
  /** Retient la prochaine annulation jusqu'à `release()` (un passage encore en cours). */
  const holdNextCancel = () => {
    let release = () => {};
    cancel.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = () => {
            store.clear();
            resolve();
          };
        }),
    );
    return () => release();
  };
  const at = (day: number, hour: number) => new Date(2026, 8, day, hour, 0).toISOString();
  const flush = () => new Promise((r) => setImmediate(r));
  const fireTime = (req: Notifications.NotificationRequestInput) =>
    (req.trigger as { date: Date }).date.getTime();

  beforeEach(() => {
    store = new Map();
    cancel.mockImplementation(async () => store.clear());
    schedule.mockImplementation(async (req) => {
      store.set(req.identifier ?? '', fireTime(req));
      return req.identifier ?? '';
    });
  });
  afterEach(() => {
    cancel.mockImplementation(async () => undefined);
    schedule.mockImplementation(async () => 'id');
  });

  it('un passage commencé finit avant le suivant : aucun rappel fantôme', async () => {
    const release = holdNextCancel();
    // A : la tâche a un rappel. B (juste après) : la tâche est terminée, plus aucun rappel.
    const a = syncScheduledNotifications(db, agenda([task]), now);
    await flush();
    const b = syncScheduledNotifications(db, agenda([{ ...task, status: 'done' }]), now);
    await flush();
    // B attend A : il n'a encore rien annulé.
    expect(cancel).toHaveBeenCalledTimes(1);
    release();
    expect(await a).toBe(1);
    expect(await b).toBe(0);
    // A a programmé son rappel, puis B a tout annulé : rien ne reste.
    expect(store.size).toBe(0);
    // L'empreinte est celle de B : le même plan ne refait rien, un rappel revenu est reprogrammé.
    await syncScheduledNotifications(db, agenda([{ ...task, status: 'done' }]), now);
    expect(cancel).toHaveBeenCalledTimes(2);
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(store.size).toBe(1);
  });

  it('appels regroupés pendant un passage : seul le plan le plus récent est programmé', async () => {
    const release = holdNextCancel();
    const a = syncScheduledNotifications(db, agenda([task]), now);
    await flush();
    const b = syncScheduledNotifications(db, agenda([{ ...task, reminderAt: at(27, 9) }]), now);
    const c = syncScheduledNotifications(db, agenda([{ ...task, reminderAt: at(26, 9) }]), now);
    release();
    await Promise.all([a, b, c]);
    // Deux passages seulement : A, puis C à la place de B.
    expect(cancel).toHaveBeenCalledTimes(2);
    const fired = schedule.mock.calls.map(([req]) => fireTime(req));
    expect(fired).toEqual([new Date(task.reminderAt!).getTime(), new Date(at(26, 9)).getTime()]);
    expect([...store.values()]).toEqual([new Date(at(26, 9)).getTime()]);
  });

  it('un rappel refusé : l’empreinte n’est pas posée, le passage suivant reprogramme', async () => {
    schedule.mockRejectedValueOnce(new Error('quota'));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(store.size).toBe(0);
    // Même plan : pas « déjà programmé », il est refait.
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(store.size).toBe(1);
    quiet.mockRestore();
  });

  it('« tout annuler » attend le passage en cours : rien n’est reprogrammé après', async () => {
    const release = holdNextCancel();
    const a = syncScheduledNotifications(db, agenda([task]), now);
    await flush();
    const wiped = cancelAllReminders();
    release();
    await Promise.all([a, wiped]);
    expect(store.size).toBe(0);
    // L'empreinte est oubliée : le plan est reprogrammé au prochain passage.
    await syncScheduledNotifications(db, agenda([task]), now);
    expect(store.size).toBe(1);
  });
});

describe('état des rappels (Réglages › Notifications) et filet de sécurité', () => {
  const habit = {
    id: 'h1',
    position: 0,
    name: 'Lire',
    icon: 'book',
    colorId: 'blue',
    frequency: 'daily' as const,
    weekdays: [],
    timesPerWeek: 1,
    target: 1,
    unit: null,
    reminderTime: '21:00',
    autoStudy: false,
    tracksBody: false,
  };
  const withHabit = (work: WorkItem[]) => agenda(work, { habits: [habit], habitLogs: [] });
  const permissions = jest.mocked(Notifications.getPermissionsAsync);
  let statusDb: Db & { close(): void };
  beforeEach(async () => {
    statusDb = await createTestDb();
    await setNotificationPreferences(statusDb, {
      ...defaultNotificationPreferences,
      eveningReview: false,
    });
  });
  afterEach(() => statusDb.close());

  it('après un passage réussi : nombre, dernier rappel et heure du passage', async () => {
    expect(await getReminderRunStatus(statusDb)).toBeNull();
    await syncScheduledNotifications(statusDb, agenda([task]), now);
    expect(await getReminderRunStatus(statusDb)).toEqual({
      count: 1,
      lastAt: task.reminderAt,
      ranAt: now.toISOString(),
      safetyNetAt: null,
    });
  });

  it('une habitude : le filet est programmé avec le plan, sans compter comme un rappel', async () => {
    const count = await syncScheduledNotifications(statusDb, withHabit([]), now);
    expect(schedule).toHaveBeenCalledTimes(count);
    const nets = schedule.mock.calls.filter(([req]) => req.identifier?.startsWith('refresh:'));
    expect(nets).toHaveLength(1);
    const net = nets[0]![0];
    expect(net.content.title).toBe(i18n.t('notif.refreshTitle'));
    expect(net.content.body).toBe(i18n.t('notif.refreshBody'));
    expect(net.content.data).toEqual({ kind: 'refresh' });
    const status = await getReminderRunStatus(statusDb);
    expect(status?.count).toBe(count - 1);
    expect(status?.safetyNetAt).toBe((net.trigger as { date: Date }).date.toISOString());
    expect(Date.parse(status!.safetyNetAt!)).toBeLessThan(Date.parse(status!.lastAt!));
  });

  it('permission manquante : rien n’est programmé, pas de filet, aucun état', async () => {
    permissions.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await syncScheduledNotifications(statusDb, withHabit([task]), now)).toBe(0);
    expect(schedule).not.toHaveBeenCalled();
    expect(await getReminderRunStatus(statusDb)).toBeNull();
  });

  it('un rappel refusé : l’état du dernier passage réussi est gardé', async () => {
    await syncScheduledNotifications(statusDb, agenda([task]), now);
    const before = await getReminderRunStatus(statusDb);
    schedule.mockRejectedValueOnce(new Error('quota'));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    const later = new Date(2026, 8, 24, 8, 0);
    await syncScheduledNotifications(statusDb, agenda([task, { ...task, id: 'w2' }]), later);
    expect(await getReminderRunStatus(statusDb)).toEqual(before);
    quiet.mockRestore();
  });

  it('bilan du soir : le premier s’explique, une seule fois (jour retenu)', async () => {
    await setNotificationPreferences(statusDb, defaultNotificationPreferences);
    await syncScheduledNotifications(statusDb, agenda([]), now);
    expect(await getReviewIntroDate(statusDb)).toBe('2026-09-23');
    const body = (id: string) =>
      schedule.mock.calls.find(([req]) => req.identifier === id)?.[0].content.body;
    expect(body('review:2026-09-23')).toBe(i18n.t('notif.reviewBodyFirst'));
    expect(body('review:2026-09-24')).toBe(i18n.t('notif.reviewBody'));
    // Le lendemain, le jour d'introduction est passé : plus aucun texte d'introduction.
    schedule.mockClear();
    await syncScheduledNotifications(statusDb, agenda([]), new Date(2026, 8, 24, 8, 0));
    expect(await getReviewIntroDate(statusDb)).toBe('2026-09-23');
    const intro = i18n.t('notif.reviewBodyFirst');
    expect(schedule.mock.calls.some(([req]) => req.content.body === intro)).toBe(false);
  });
});
