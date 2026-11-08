import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createSubject } from '@/modules/academic';
import { addAttachment, createNote, getNote, listNotes } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import NoteScreen from '../notes/[id]';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = { id: 'new' };
const mockFail = { read: 0, save: 0 };
const mockToast = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    // Les boutons de l'en-tête (« Modifier ») sont rendus avec l'écran.
    Stack: {
      Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) =>
        options?.headerRight ? options.headerRight() : null,
    },
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
// Lecture et enregistrement qu'on peut faire échouer N fois.
jest.mock('@/modules/productivity', () => {
  const actual = jest.requireActual('@/modules/productivity');
  return {
    ...actual,
    getNote: (db: unknown, id: string) => {
      if (mockFail.read > 0) {
        mockFail.read--;
        return Promise.reject(new Error('disk'));
      }
      return actual.getNote(db, id);
    },
    saveNoteContent: (db: unknown, id: string, title: string, content: string) => {
      if (mockFail.save > 0) {
        mockFail.save--;
        return Promise.reject(new Error('disk'));
      }
      return actual.saveNoteContent(db, id, title, content);
    },
  };
});
jest.mock('@/shared/ui', () => ({
  ...jest.requireActual('@/shared/ui'),
  showToast: (...args: unknown[]) => mockToast(...args),
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(async () => {
  mockFail.read = 0;
  mockFail.save = 0;
  mockToast.mockClear();
  jest.mocked(router.back).mockClear();
  await mockDb.runAsync('DELETE FROM notes', []);
  await mockDb.runAsync('DELETE FROM sync_outbox', []);
});
afterEach(() => jest.restoreAllMocks());

const flush = async () => {
  for (let i = 0; i < 10; i++) await act(async () => {});
};
const wait = (ms: number) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

async function show(params: Record<string, string>) {
  mockParams = params;
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <NoteScreen />
    </SafeAreaProvider>,
  );
  await flush();
  return view;
}

const OLD = '2026-01-01T00:00:00.000Z';
/** Une note déjà synchronisée, modifiée pour la dernière fois le 1er janvier. */
async function syncedNote(title: string, content: string) {
  const id = await createNote(mockDb, { title, content });
  await mockDb.runAsync("UPDATE notes SET updated_at = ?, sync_status = 'synced' WHERE id = ?", [
    OLD,
    id,
  ]);
  await mockDb.runAsync('DELETE FROM sync_outbox', []);
  return id;
}
const outboxCount = async () =>
  (await mockDb.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sync_outbox', []))?.n ?? 0;
const updatedAt = async (id: string) =>
  (
    await mockDb.getFirstAsync<{ u: string }>('SELECT updated_at AS u FROM notes WHERE id = ?', [
      id,
    ])
  )?.u;

describe('note : rien n’est réécrit sans changement', () => {
  it('lire une note puis la quitter ne change ni sa date ni la file', async () => {
    const id = await syncedNote('Chimie', 'Formules');
    const view = await show({ id });
    expect(screen.getByDisplayValue('Chimie')).toBeTruthy();
    await view.unmount();
    await flush();
    expect(await updatedAt(id)).toBe(OLD);
    expect(await outboxCount()).toBe(0);
  });

  it('un texte modifié puis remis comme avant n’est pas réécrit', async () => {
    const id = await syncedNote('Chimie', 'Formules');
    const view = await show({ id });
    await fireEvent.press(screen.getByText(i18n.t('notes.edit')));
    const title = screen.getByDisplayValue('Chimie');
    await fireEvent.changeText(title, 'Chimie organique');
    await fireEvent.changeText(title, 'Chimie');
    await wait(700);
    await flush();
    await view.unmount();
    await flush();
    expect(await updatedAt(id)).toBe(OLD);
    expect(await outboxCount()).toBe(0);
  });

  it('une vraie modification est enregistrée, une seule fois', async () => {
    const id = await syncedNote('Chimie', 'Formules');
    const view = await show({ id });
    await fireEvent.press(screen.getByText(i18n.t('notes.edit')));
    await fireEvent.changeText(screen.getByDisplayValue('Chimie'), 'Chimie organique');
    await wait(700);
    await flush();
    await view.unmount();
    await flush();
    expect((await getNote(mockDb, id))?.title).toBe('Chimie organique');
    expect(await updatedAt(id)).not.toBe(OLD);
    // L'autosave a écrit ; la sortie de l'écran n'ajoute rien.
    expect(await outboxCount()).toBe(1);
  });
});

describe('note : titre pré-rempli depuis un cours', () => {
  it('ressortir sans rien écrire ne crée aucune note', async () => {
    const subjectId = await createSubject(mockDb, { name: 'Maths', colorId: 'blue' });
    const view = await show({ id: 'new', subjectId, courseDate: '2026-09-23' });
    await flush();
    expect(screen.getByDisplayValue(/^Maths — /)).toBeTruthy();
    await wait(700);
    await view.unmount();
    await flush();
    expect(await listNotes(mockDb)).toHaveLength(0);
  });

  it('un texte saisi crée la note avec le titre pré-rempli', async () => {
    const subjectId = await createSubject(mockDb, { name: 'Physique', colorId: 'blue' });
    const view = await show({ id: 'new', subjectId, courseDate: '2026-09-23' });
    await flush();
    const prefilled = screen.getByDisplayValue(/^Physique — /).props.value as string;
    await fireEvent.changeText(screen.getByDisplayValue(prefilled), `${prefilled} (TD)`);
    await wait(700);
    await flush();
    await view.unmount();
    await flush();
    const notes = await listNotes(mockDb);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe(`${prefilled} (TD)`);
  });
});

describe('note : états de l’écran', () => {
  it('lecture en échec : « Réessayer », jamais un chargement sans fin ni une note vidée', async () => {
    const id = await syncedNote('Histoire', 'Dates');
    mockFail.read = 1;
    const view = await show({ id });
    expect(screen.getByText(i18n.t('errors.loadFailed'))).toBeTruthy();
    expect(screen.queryByTestId('state-loading')).toBeNull();
    await fireEvent.press(screen.getByText(i18n.t('errors.retry')));
    await flush();
    expect(screen.getByDisplayValue('Histoire')).toBeTruthy();
    await view.unmount();
    await flush();
    expect(await getNote(mockDb, id)).toMatchObject({ title: 'Histoire', content: 'Dates' });
  });

  it('quitter après une lecture en échec n’écrit rien', async () => {
    const id = await syncedNote('Histoire', 'Dates');
    mockFail.read = 1;
    const view = await show({ id });
    await view.unmount();
    await flush();
    expect(await getNote(mockDb, id)).toMatchObject({ title: 'Histoire', content: 'Dates' });
    expect(await outboxCount()).toBe(0);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('note introuvable : message clair et bouton retour', async () => {
    await show({ id: 'absente' });
    expect(screen.getByText(i18n.t('notes.notFound'))).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t('common.back')));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});

describe('note : échec de l’enregistrement automatique', () => {
  it('une seule indication, sans alerte, et nouvel essai à la modification suivante', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const id = await syncedNote('Brouillon', 'Début');
    const view = await show({ id });
    await fireEvent.press(screen.getByText(i18n.t('notes.edit')));
    mockFail.save = 2;
    const title = screen.getByDisplayValue('Brouillon');
    await fireEvent.changeText(title, 'Brouillon 1');
    await wait(700);
    await flush();
    await fireEvent.changeText(title, 'Brouillon 12');
    await wait(700);
    await flush();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getAllByText(i18n.t('notes.unsavedRetry'))).toHaveLength(1);
    // La modification suivante retente, et réussit : l'indication disparaît.
    await fireEvent.changeText(title, 'Brouillon 123');
    await wait(700);
    await flush();
    expect(screen.queryByText(i18n.t('notes.unsavedRetry'))).toBeNull();
    expect((await getNote(mockDb, id))?.title).toBe('Brouillon 123');
    await view.unmount();
    await flush();
  });

  it('« Réessayer » relance l’enregistrement', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const id = await syncedNote('Plan', 'A');
    const view = await show({ id });
    await fireEvent.press(screen.getByText(i18n.t('notes.edit')));
    mockFail.save = 1;
    await fireEvent.changeText(screen.getByDisplayValue('Plan'), 'Plan B');
    await wait(700);
    await flush();
    await fireEvent.press(screen.getByText(i18n.t('notes.unsavedRetry')));
    await flush();
    expect(screen.queryByText(i18n.t('notes.unsavedRetry'))).toBeNull();
    expect((await getNote(mockDb, id))?.title).toBe('Plan B');
    await view.unmount();
    await flush();
  });
});

describe('note : pièce jointe', () => {
  it('« Retirer » offre une zone tactile d’au moins 44 pt', async () => {
    const id = await syncedNote('TD', 'Voir le PDF');
    await addAttachment(mockDb, id, {
      kind: 'file',
      name: 'td1.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      localPath: `attachments/${id}/a.pdf`,
    });
    const view = await show({ id });
    await fireEvent.press(screen.getByText(i18n.t('notes.edit')));
    const remove = screen.getByLabelText(`${i18n.t('notes.removeAttachment')} td1.pdf`);
    const style = StyleSheet.flatten(remove.props.style) as {
      minHeight?: number;
      minWidth?: number;
    };
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    await view.unmount();
    await flush();
  });
});
