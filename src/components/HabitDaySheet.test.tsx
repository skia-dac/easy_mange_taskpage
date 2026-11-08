/**
 * La fenêtre « noter un jour » reste montée : fermée, elle garde l'habitude affichée pendant sa
 * sortie et signale la fin de la fermeture ; rouverte, elle repart des valeurs enregistrées.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Habit } from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import { HabitDaySheet } from './HabitDaySheet';

let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));

/** Modal simulée : garde son contenu monté et retient `visible` / `onDismiss`. */
const mockModal: { visible?: boolean; onDismiss?: () => void } = {};
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function Modal(props: { visible: boolean; onDismiss?: () => void; children: ReactNode }) {
    mockModal.visible = props.visible;
    mockModal.onDismiss = props.onDismiss;
    return React.createElement(React.Fragment, null, props.children);
  }
  return { __esModule: true, default: Modal };
});

const habit = (id: string, name: string): Habit => ({
  id,
  name,
  position: 0,
  icon: 'check-circle',
  colorId: 'blue',
  frequency: 'daily',
  weekdays: [],
  timesPerWeek: 1,
  target: 1,
  unit: null,
  reminderTime: null,
  autoStudy: false,
  tracksBody: false,
});

const read = habit('h1', 'Lire');
const onDismissed = jest.fn();

function Harness() {
  const [sheet, setSheet] = useState<Habit | null>(read);
  return (
    <>
      <HabitDaySheet
        visible={sheet !== null}
        habit={sheet}
        date="2026-09-23"
        log={undefined}
        onClose={() => setSheet(null)}
        onDismissed={onDismissed}
      />
      {/* Rouvrir depuis l'écran (bouton factice du test). */}
      <Pressable onPress={() => setSheet(read)}>
        <Text>rouvrir</Text>
      </Pressable>
    </>
  );
}

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

describe('HabitDaySheet pilotée par visible', () => {
  it('fermée : garde l’habitude affichée et signale la fin de la fermeture', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <Harness />
      </SafeAreaProvider>,
    );
    expect(mockModal.visible).toBe(true);
    // Un choix non enregistré…
    await fireEvent.press(screen.getByRole('button', { name: i18n.t('habits.missed') }));
    expect(screen.getByText(i18n.t('habits.reasonOptional'))).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(mockModal.visible).toBe(false);
    // Pendant la sortie, le contenu reste (pas de fenêtre vide qui disparaît).
    expect(screen.getByText('Lire')).toBeTruthy();
    expect(mockModal.onDismiss).toBe(onDismissed);

    // …est oublié à la réouverture : on repart de ce qui est enregistré (rien).
    await fireEvent.press(screen.getByText('rouvrir'));
    await act(async () => {});
    expect(mockModal.visible).toBe(true);
    expect(screen.queryByText(i18n.t('habits.reasonOptional'))).toBeNull();
  });
});
