import { createSubject } from '@/modules/academic';
import { createNote, deleteNote } from '@/modules/productivity';
import { createTestDb } from '@/test/memoryDb';

import {
  ACCOUNT_REMINDER_MIN_ITEMS,
  COUNTED_TABLES,
  countUserItems,
  getAccountReminderSnoozedAt,
  isAccountReminderSnoozed,
  setAccountReminderSnoozedAt,
  shouldShowAccountReminder,
  type AccountReminderInput,
} from './accountReminder';

const now = new Date('2026-11-08T10:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const base: AccountReminderInput = {
  accountsEnabled: true,
  authLoading: false,
  signedIn: false,
  itemCount: ACCOUNT_REMINDER_MIN_ITEMS,
  snoozedAt: null,
  now,
};

describe('carte « Crée un compte » sur Aujourd’hui', () => {
  it('apparaît sans compte, avec assez de données, sans « Plus tard » récent', () => {
    expect(shouldShowAccountReminder(base)).toBe(true);
  });

  it('se tait avec un compte, sans comptes disponibles, ou pendant la lecture de la session', () => {
    expect(shouldShowAccountReminder({ ...base, signedIn: true })).toBe(false);
    expect(shouldShowAccountReminder({ ...base, accountsEnabled: false })).toBe(false);
    expect(shouldShowAccountReminder({ ...base, authLoading: true })).toBe(false);
  });

  it('attend qu’il y ait vraiment des données à perdre (10 éléments)', () => {
    expect(ACCOUNT_REMINDER_MIN_ITEMS).toBe(10);
    expect(shouldShowAccountReminder({ ...base, itemCount: 9 })).toBe(false);
    expect(shouldShowAccountReminder({ ...base, itemCount: 0 })).toBe(false);
  });

  it('« Plus tard » la fait taire 14 jours, puis elle revient', () => {
    expect(shouldShowAccountReminder({ ...base, snoozedAt: daysAgo(0) })).toBe(false);
    expect(shouldShowAccountReminder({ ...base, snoozedAt: daysAgo(13.9) })).toBe(false);
    expect(shouldShowAccountReminder({ ...base, snoozedAt: daysAgo(14) })).toBe(true);
    expect(shouldShowAccountReminder({ ...base, snoozedAt: daysAgo(40) })).toBe(true);
  });

  it('une date de « Plus tard » dans le futur (horloge changée) ne la bloque pas pour toujours', () => {
    expect(isAccountReminderSnoozed(daysAgo(-3), now)).toBe(false);
  });
});

describe('données de la carte', () => {
  it('compte les éléments vivants de l’utilisateur, pas les supprimés ni les réglages', async () => {
    const db = await createTestDb();
    expect(await countUserItems(db)).toBe(0);
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const note = await createNote(db, { title: 'Un', content: '', subjectId });
    await createNote(db, { title: 'Deux', content: '' });
    expect(await countUserItems(db)).toBe(3);
    await deleteNote(db, note);
    expect(await countUserItems(db)).toBe(2);
    db.close();
  });

  it('chaque table comptée a une colonne deleted_at', async () => {
    const db = await createTestDb();
    for (const table of COUNTED_TABLES) {
      const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, []);
      expect(cols.map((c) => c.name)).toContain('deleted_at');
    }
    db.close();
  });

  it('retient « Plus tard » dans les réglages du téléphone', async () => {
    const db = await createTestDb();
    expect(await getAccountReminderSnoozedAt(db)).toBeNull();
    await setAccountReminderSnoozedAt(db, now.toISOString());
    expect(await getAccountReminderSnoozedAt(db)).toBe(now.toISOString());
    db.close();
  });
});
