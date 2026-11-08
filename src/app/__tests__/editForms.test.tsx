import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { usePreventRemove } from 'expo-router/react-navigation';
import type { ComponentType } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createExam, createSubject, getExam } from '@/modules/academic';
import { createPersonalEvent, getPersonalEvent } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { createTestDb } from '@/test/memoryDb';

import EventFormScreen from '../events/form';
import ExamFormScreen from '../exams/form';

let mockDb: Db & { close(): void };
let mockParams: Record<string, string> = {};
/** Lectures qui échouent avant de réussir (simule une base momentanément illisible). */
const mockFailures = { event: 0 };
/** Lecture retenue jusqu'à `release()` (pour voir l'écran pendant le chargement). */
const mockHold: { wait: Promise<void> | null } = { wait: null };

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    useSegments: () => [],
    Stack: { Screen: () => null },
  };
});
jest.mock('@/modules/productivity', () => {
  const actual = jest.requireActual('@/modules/productivity');
  return {
    ...actual,
    getPersonalEvent: async (...args: unknown[]) => {
      if (mockHold.wait) await mockHold.wait;
      if (mockFailures.event > 0) {
        mockFailures.event -= 1;
        return Promise.reject(new Error('lecture impossible'));
      }
      return actual.getPersonalEvent(...args);
    },
  };
});
const mockAsk = jest.fn(async () => 'granted' as const);
jest.mock('@/hooks/useNotificationPermission', () => ({
  ...jest.requireActual('@/hooks/useNotificationPermission'),
  askNotificationPermission: () => mockAsk(),
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const prevent = jest.mocked(usePreventRemove);
/** La garde « Abandonner les modifications ? » est-elle active ? */
const guarded = () => prevent.mock.calls.at(-1)?.[0];

let eventId = '';
let subjectId = '';
let examId = '';
beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  eventId = await createPersonalEvent(mockDb, {
    title: 'Dentiste',
    date: '2026-09-30',
    startTime: '14:00',
    endTime: null,
    description: 'Apporter la carte',
    reminderAt: null,
  });
  subjectId = await createSubject(mockDb, { name: 'Droit civil', colorId: 'violet' });
  examId = await createExam(mockDb, {
    subjectId,
    title: 'Partiel de droit',
    date: '2026-10-20',
    time: '09:00',
    reminderDays: [],
  });
});
afterAll(() => mockDb.close());
beforeEach(() => {
  prevent.mockClear();
  mockAsk.mockClear();
  mockFailures.event = 0;
});

const flush = () => act(async () => {});

async function show(Screen: ComponentType) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <GestureHandlerRootView>
        <SpacesContext.Provider value={spacesValue(['study', 'personal'])}>
          <Screen />
        </SpacesContext.Provider>
      </GestureHandlerRootView>
    </SafeAreaProvider>,
  );
}

describe('modifier un rendez-vous : la fiche d’abord, jamais les valeurs par défaut', () => {
  it('pendant la lecture, aucun champ ; puis les valeurs enregistrées', async () => {
    mockParams = { id: eventId };
    let release: () => void = () => undefined;
    mockHold.wait = new Promise((r) => (release = r));
    await show(EventFormScreen);
    // Avant la réponse de la base : un chargement, pas un formulaire vide « Modifier… ».
    expect(screen.getByTestId('state-loading')).toBeTruthy();
    expect(screen.queryByText(/^Titre/)).toBeNull();
    mockHold.wait = null;
    await act(async () => release());
    await flush();
    expect(screen.getByDisplayValue('Dentiste')).toBeTruthy();
    expect(screen.getByDisplayValue('Apporter la carte')).toBeTruthy();
    // La fiche chargée est l'état de départ : rien n'est encore modifié.
    expect(guarded()).toBe(false);
  });

  it('rendez-vous supprimé : « introuvable » avec « Retour »', async () => {
    mockParams = { id: 'disparu' };
    await show(EventFormScreen);
    await flush();
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
    expect(screen.getByText('Retour')).toBeTruthy();
    expect(screen.queryByText(/^Titre/)).toBeNull();
  });

  it('lecture ratée : erreur et « Réessayer », qui affiche la fiche', async () => {
    mockFailures.event = 1;
    mockParams = { id: eventId };
    await show(EventFormScreen);
    await flush();
    expect(screen.getByText(i18n.t('state.itemErrorTitle'))).toBeTruthy();
    expect(screen.queryByText(i18n.t('errors.itemNotFound'))).toBeNull();
    await fireEvent.press(screen.getByText('Réessayer'));
    await flush();
    expect(screen.getByDisplayValue('Dentiste')).toBeTruthy();
  });

  it('modifié : quitter demande confirmation ; enregistré : on sort sans question', async () => {
    mockParams = { id: eventId };
    await show(EventFormScreen);
    await flush();
    await fireEvent.changeText(screen.getByDisplayValue('Dentiste'), 'Dentiste (contrôle)');
    expect(guarded()).toBe(true);
    await fireEvent.press(screen.getByText(i18n.t('events.save')));
    await flush();
    expect((await getPersonalEvent(mockDb, eventId))?.title).toBe('Dentiste (contrôle)');
  });
});

describe('modifier un examen', () => {
  it('les valeurs enregistrées, la garde seulement après une modification', async () => {
    mockParams = { id: examId };
    await show(ExamFormScreen);
    await flush();
    expect(screen.getByDisplayValue('Partiel de droit')).toBeTruthy();
    expect(guarded()).toBe(false);
    await fireEvent.changeText(screen.getByDisplayValue('Partiel de droit'), 'Partiel final');
    expect(guarded()).toBe(true);
  });

  it('examen supprimé : « introuvable », pas un formulaire vide', async () => {
    mockParams = { id: 'disparu' };
    await show(ExamFormScreen);
    await flush();
    expect(screen.getByText(i18n.t('errors.itemNotFound'))).toBeTruthy();
    expect(screen.queryByText(/^Matière/)).toBeNull();
  });

  it('enregistré avec des rappels : la permission des notifications est demandée', async () => {
    mockParams = { id: examId };
    await show(ExamFormScreen);
    await flush();
    // Aucun rappel : rien à demander.
    await fireEvent.press(screen.getByText(i18n.t('exams.save')));
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText(i18n.t('reminder.daysBefore', { count: 1 })));
    await fireEvent.press(screen.getByText(i18n.t('exams.save')));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect((await getExam(mockDb, examId))?.reminderDays).toEqual([1]);
  });

  it('nouvel examen : rappels 7 jours et 1 jour avant par défaut, permission demandée', async () => {
    mockParams = { subjectId };
    await show(ExamFormScreen);
    await flush();
    await fireEvent.press(screen.getByText(i18n.t('exams.save')));
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
  });
});
