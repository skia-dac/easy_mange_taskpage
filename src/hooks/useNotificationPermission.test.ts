import { Alert } from 'react-native';

import { getNotificationPromptSnoozedAt } from '@/modules/identity';
import type { NotificationPermission } from '@/modules/platform';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { askNotificationPermission, isPromptSnoozed } from './useNotificationPermission';

const mockPermission = {
  state: 'undetermined' as NotificationPermission,
  ensure: jest.fn(async () => true),
};
jest.mock('@/modules/platform', () => ({
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
}));

/** La boîte d'explication : on appuie sur le bouton dont le texte est donné. */
function answerAlert(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

const day = 24 * 60 * 60 * 1000;
const monday = new Date(2026, 9, 5, 10, 0);
const later = (days: number) => new Date(monday.getTime() + days * day);

let db: Db & { close(): void };
beforeEach(async () => {
  await i18n.changeLanguage('fr');
  db = await createTestDb();
  mockPermission.state = 'undetermined';
  mockPermission.ensure.mockClear();
});
afterEach(() => {
  db.close();
  jest.restoreAllMocks();
});

describe('demande de la permission des notifications', () => {
  it('« Plus tard » est retenu : rien n’est redemandé pendant 7 jours', async () => {
    const alert = answerAlert('Plus tard');
    expect(await askNotificationPermission(db, { now: monday })).toBe('undetermined');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(await getNotificationPromptSnoozedAt(db)).toBe(monday.toISOString());

    // Nouveaux rappels dans la semaine : aucune question.
    await askNotificationPermission(db, { now: later(1) });
    await askNotificationPermission(db, { now: later(6.9) });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockPermission.ensure).not.toHaveBeenCalled();

    // 7 jours plus tard : l'explication revient une fois.
    await askNotificationPermission(db, { now: later(7) });
    expect(alert).toHaveBeenCalledTimes(2);
  });

  it('« Autoriser » touché par l’utilisateur : demandé même après un « Plus tard » récent', async () => {
    answerAlert('Plus tard');
    await askNotificationPermission(db, { now: monday });
    jest.restoreAllMocks();
    const alert = answerAlert('Continuer');
    mockPermission.ensure.mockImplementation(async () => {
      mockPermission.state = 'granted';
      return true;
    });
    expect(await askNotificationPermission(db, { force: true, now: later(1) })).toBe('granted');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockPermission.ensure).toHaveBeenCalledTimes(1);
    // Accepté : le « Plus tard » est oublié.
    expect(await getNotificationPromptSnoozedAt(db)).toBeNull();
  });

  it('déjà accordée ou refusée : aucune question', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    mockPermission.state = 'granted';
    expect(await askNotificationPermission(db)).toBe('granted');
    mockPermission.state = 'denied';
    expect(await askNotificationPermission(db, { force: true })).toBe('denied');
    expect(alert).not.toHaveBeenCalled();
  });

  it('fenêtre de 7 jours : une date dans le futur ne bloque pas', () => {
    const at = monday.toISOString();
    expect(isPromptSnoozed(null, monday)).toBe(false);
    expect(isPromptSnoozed(at, later(3))).toBe(true);
    expect(isPromptSnoozed(at, later(7))).toBe(false);
    expect(isPromptSnoozed(at, later(-1))).toBe(false);
  });
});
