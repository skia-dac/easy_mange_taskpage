import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { addAttachment, createNote, getNote } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import NoteScreen from '../notes/[id]';

let mockDb: Db & { close(): void };
const mockParams: Record<string, string> = { id: 'new' };
const mockHeader: { title?: string } = {};
const mockDelete = { fail: false };
const mockOpen = jest.fn(async () => false);
const mockToast = jest.fn();

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: {
      Screen: ({ options }: { options?: { title?: string } }) => {
        mockHeader.title = options?.title;
        return null;
      },
    },
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
  attachmentExists: () => true,
  attachmentUri: (p: string) => `file:///docs/${p}`,
  deleteLocalFile: () => undefined,
  openLocalFile: (...args: unknown[]) => mockOpen(...(args as [])),
}));
jest.mock('@/modules/productivity', () => {
  const actual = jest.requireActual('@/modules/productivity');
  return {
    ...actual,
    deleteNote: (db: unknown, id: string) =>
      mockDelete.fail ? Promise.reject(new Error('disk')) : actual.deleteNote(db, id),
  };
});
jest.mock('@/shared/ui', () => ({
  ...jest.requireActual('@/shared/ui'),
  showToast: (...args: unknown[]) => mockToast(...args),
}));

// Une seule base pour le fichier : les lectures partagées (matières) la gardent en mémoire.
beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());
beforeEach(() => {
  mockToast.mockClear();
  mockOpen.mockClear();
});
afterEach(() => jest.restoreAllMocks());

const flush = () => act(async () => {});

async function show(id: string) {
  mockParams.id = id;
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <NoteScreen />
    </SafeAreaProvider>,
  );
}

describe('note : suppression et pièces jointes', () => {
  it('suppression en échec : la note n’est jamais vidée, même en quittant l’écran', async () => {
    const id = await createNote(mockDb, { title: 'Chimie', content: 'Formules importantes' });
    const view = await show(id);
    await flush();
    // Titre d'écran accessible, jamais vide.
    expect(mockHeader.title).toBe('Note');
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive' || b.text === 'OK')?.onPress?.();
    });
    mockDelete.fail = true;
    await fireEvent.press(screen.getByText('Supprimer la note'));
    await flush();
    await view.unmount();
    await flush();
    expect(await getNote(mockDb, id)).toMatchObject({
      title: 'Chimie',
      content: 'Formules importantes',
    });
    mockDelete.fail = false;
  });

  it('suppression réussie : la sortie de l’écran ne recrée rien', async () => {
    const id = await createNote(mockDb, { title: 'Brouillon', content: 'À jeter' });
    const view = await show(id);
    await flush();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByText('Supprimer la note'));
    await flush();
    await view.unmount();
    await flush();
    expect(await getNote(mockDb, id)).toBeNull();
    const n = await mockDb.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM notes WHERE deleted_at IS NULL AND title = 'Brouillon'",
      [],
    );
    expect(n?.n).toBe(0);
  });

  it('une pièce jointe s’ouvre par la feuille de partage ; sinon un message clair', async () => {
    const id = await createNote(mockDb, { title: 'TD', content: 'Voir le PDF' });
    await addAttachment(mockDb, id, {
      kind: 'file',
      name: 'td1.pdf',
      mimeType: 'application/pdf',
      size: 1200,
      localPath: `attachments/${id}/a.pdf`,
    });
    await show(id);
    await flush();
    await fireEvent.press(screen.getByLabelText('td1.pdf'));
    await flush();
    expect(mockOpen).toHaveBeenCalledWith(
      `file:///docs/attachments/${id}/a.pdf`,
      'application/pdf',
      'td1.pdf',
    );
    expect(mockToast).toHaveBeenCalledWith(
      {
        title: 'Impossible d’ouvrir ce fichier',
        detail: 'Aucune app de ce téléphone ne sait le lire.',
      },
      { tone: 'error' },
    );
  });
});
