import { defaultNotificationPreferences } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

import type { PlannedReminder } from './plan';
import {
  getReminderRunStatus,
  remindersPaused,
  reminderStatusView,
  setReminderRunStatus,
  summarizePlan,
} from './status';

const now = new Date(2026, 8, 23, 8, 0);
const reminder = (id: string, fireAt: Date, kind: 'habit' | 'refresh' = 'habit') =>
  ({
    id,
    fireAt,
    title: { key: 'x' },
    body: { key: 'x' },
    action: kind === 'refresh' ? { kind } : { kind, id },
  }) as PlannedReminder;

const off = {
  ...defaultNotificationPreferences,
  courses: false,
  endOfCourse: false,
  assignments: false,
  tasks: false,
  exams: false,
  events: false,
  habits: false,
  revisions: false,
  money: false,
  eveningReview: false,
};
const both = { study: true, personal: true };

describe('résumé du plan programmé', () => {
  it('nombre et dernier rappel, sans le filet de sécurité', () => {
    const last = new Date(2026, 11, 14, 21, 0);
    const net = new Date(2026, 11, 14, 9, 0);
    const status = summarizePlan(
      [
        reminder('a', new Date(2026, 8, 24, 21, 0)),
        reminder('refresh:2026-12-14', net, 'refresh'),
        reminder('b', last),
      ],
      now,
    );
    expect(status).toEqual({
      count: 2,
      lastAt: last.toISOString(),
      ranAt: now.toISOString(),
      safetyNetAt: net.toISOString(),
    });
    expect(summarizePlan([], now)).toEqual({
      count: 0,
      lastAt: null,
      ranAt: now.toISOString(),
      safetyNetAt: null,
    });
  });

  it('enregistré dans app_settings, illisible = inconnu', async () => {
    const db: Db & { close(): void } = await createTestDb();
    expect(await getReminderRunStatus(db)).toBeNull();
    const status = summarizePlan([reminder('a', new Date(2026, 8, 24, 21, 0))], now);
    await setReminderRunStatus(db, status);
    expect(await getReminderRunStatus(db)).toEqual(status);
    await db.runAsync('UPDATE app_settings SET value = \'{"count":-1}\' WHERE key = ?', [
      'reminder_status',
    ]);
    expect(await getReminderRunStatus(db)).toBeNull();
    db.close();
  });
});

describe('rappels en pause', () => {
  it('tout coupé : en pause ; un seul type actif : non', () => {
    expect(remindersPaused(off, both)).toBe(true);
    expect(remindersPaused({ ...off, habits: true }, both)).toBe(false);
    expect(remindersPaused(defaultNotificationPreferences, both)).toBe(false);
  });

  it('les rappels d’un espace coupé ne comptent pas', () => {
    expect(remindersPaused({ ...off, habits: true }, { study: true, personal: false })).toBe(true);
    expect(remindersPaused({ ...off, courses: true }, { study: false, personal: true })).toBe(true);
    expect(
      remindersPaused({ ...off, eveningReview: true }, { study: false, personal: false }),
    ).toBe(false);
  });
});

describe('ligne d’état des rappels', () => {
  const status = summarizePlan(
    [reminder('a', new Date(2026, 8, 24, 21, 0)), reminder('b', new Date(2026, 11, 14, 21, 0))],
    now,
  );

  it('permission refusée ou pas encore donnée : avant tout le reste', () => {
    expect(reminderStatusView({ permission: 'denied', paused: true, status })).toEqual({
      kind: 'denied',
    });
    expect(reminderStatusView({ permission: 'undetermined', paused: false, status })).toEqual({
      kind: 'undetermined',
    });
    expect(reminderStatusView({ permission: null, paused: false, status })).toBeNull();
  });

  it('accordée : en pause, en attente, aucun, ou actifs jusqu’au dernier rappel', () => {
    expect(reminderStatusView({ permission: 'granted', paused: true, status })).toEqual({
      kind: 'paused',
    });
    expect(reminderStatusView({ permission: 'granted', paused: false, status: null })).toEqual({
      kind: 'pending',
    });
    expect(
      reminderStatusView({ permission: 'granted', paused: false, status: summarizePlan([], now) }),
    ).toEqual({ kind: 'none' });
    expect(reminderStatusView({ permission: 'granted', paused: false, status })).toEqual({
      kind: 'active',
      count: 2,
      until: new Date(2026, 11, 14, 21, 0),
    });
  });
});
