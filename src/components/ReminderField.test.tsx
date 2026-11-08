import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState, type ReactElement } from 'react';
import { Pressable, Text } from 'react-native';
import { Alert, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { defaultNotificationPreferences, setNotificationPreferences } from '@/modules/identity';
import type { NotificationPermission } from '@/modules/platform';
import { shiftReminder } from '@/modules/productivity';
import { atTime } from '@/shared/dates';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

import {
  availablePresets,
  defaultCustom,
  isPast,
  ReminderField,
  type ReminderKind,
} from './ReminderField';

// Le champ lit les réglages des rappels (Réglages › Rappels) dans une vraie base.
let mockDb: Db & { close(): void };
jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
// Sélecteur natif : on garde ses props pour choisir une heure comme le ferait l'utilisateur.
type PickerProps = { mode: string; onChange?: (e: unknown, d?: Date) => void };
const mockPickers: PickerProps[] = [];
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: PickerProps) => {
    mockPickers.push(props);
    return null;
  },
  DateTimePickerAndroid: { open: jest.fn() },
}));
// Mercredi 1er octobre 2026, 10:00 : l'échéance du 10 octobre est à venir.
jest.useFakeTimers({ now: new Date(2026, 9, 1, 10, 0) });

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const inApp = (ui: ReactElement) => (
  <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>
);

const mockPermission = {
  state: 'undetermined' as NotificationPermission,
  ensure: jest.fn(async () => true),
};
jest.mock('@/modules/platform', () => ({
  notificationPermission: async () => mockPermission.state,
  ensurePermission: () => mockPermission.ensure(),
}));

const flush = () => act(async () => {});

const changes = jest.fn();

function Harness({
  initial = null,
  dueDate = '2026-10-10',
  kind,
}: {
  initial?: string | null;
  dueDate?: string | null;
  kind?: ReminderKind;
}) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ReminderField
      dueDate={dueDate}
      value={value}
      kind={kind}
      onChange={(v) => {
        changes(v);
        setValue(v);
      }}
    />
  );
}

/** La boîte d'explication : on appuie sur le bouton dont le texte est donné. */
function answerAlert(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeAll(async () => {
  mockDb = await createTestDb();
});
afterAll(() => mockDb.close());

beforeEach(async () => {
  await i18n.changeLanguage('fr');
  mockPermission.ensure.mockClear();
  changes.mockClear();
  await setNotificationPreferences(mockDb, defaultNotificationPreferences);
});
afterEach(() => jest.restoreAllMocks());

describe('rappel : la permission est demandée au bon moment', () => {
  it('premier rappel choisi : explication, puis demande du système', async () => {
    mockPermission.state = 'undetermined';
    mockPermission.ensure.mockImplementation(async () => {
      mockPermission.state = 'granted';
      return true;
    });
    const alert = answerAlert('Continuer');
    await render(inApp(<Harness />));
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    await flush();
    expect(alert).toHaveBeenCalledWith(
      i18n.t('reminder.permissionTitle'),
      expect.stringContaining('notification'),
      expect.any(Array),
      expect.any(Object),
    );
    expect(mockPermission.ensure).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('reminder-permission-off')).toBeNull();
  });

  it('explication refusée : le champ le dit, avec un bouton pour autoriser', async () => {
    mockPermission.state = 'undetermined';
    answerAlert('Annuler');
    await render(inApp(<Harness />));
    await fireEvent.press(screen.getByText('Le jour même à 09:00'));
    await flush();
    expect(mockPermission.ensure).not.toHaveBeenCalled();
    expect(screen.getByText('Les notifications sont désactivées : ce rappel ne sonnera pas.'));
    expect(screen.getByText('Autoriser les notifications')).toBeTruthy();
  });

  it('permission refusée dans le système : message et bouton vers les réglages', async () => {
    mockPermission.state = 'denied';
    const alert = jest.spyOn(Alert, 'alert');
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(inApp(<Harness initial="2026-10-09T17:00:00.000Z" />));
    await flush();
    expect(screen.getByTestId('reminder-permission-off')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir les réglages'));
    expect(settings).toHaveBeenCalled();
    // Rien n'est redemandé : seul le réglage du téléphone peut rendre la permission.
    expect(alert).not.toHaveBeenCalled();
  });

  it('permission déjà accordée : aucune question, aucun message', async () => {
    mockPermission.state = 'granted';
    const alert = jest.spyOn(Alert, 'alert');
    await render(inApp(<Harness />));
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    await flush();
    expect(alert).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reminder-permission-off')).toBeNull();
  });
});

describe('rappel : jamais dans le passé', () => {
  it('préréglages passés cachés : tâche pour aujourd’hui à 11:00', () => {
    const at11 = new Date(2026, 9, 1, 11, 0);
    // Plus de « veille », et « le jour même à 09:00 » est passé.
    expect(availablePresets('2026-10-01', at11)).toEqual(['none', 'custom']);
    // À 08:00, « le jour même à 09:00 » est encore à venir.
    expect(availablePresets('2026-10-01', new Date(2026, 9, 1, 8, 0))).toEqual([
      'none',
      'sameDay',
      'custom',
    ]);
    // Pour demain : la veille (ce soir 18:00) et le jour même restent proposés.
    expect(availablePresets('2026-10-02', at11)).toEqual([
      'none',
      'dayBefore',
      'sameDay',
      'custom',
    ]);
  });

  it('à l’écran : une tâche pour aujourd’hui ne propose pas « La veille à 18:00 »', async () => {
    mockPermission.state = 'granted';
    await render(inApp(<Harness dueDate="2026-10-01" />));
    await flush();
    expect(screen.queryByText('La veille à 18:00')).toBeNull();
    // 10:00 : « Le jour même à 09:00 » est passé lui aussi.
    expect(screen.queryByText('Le jour même à 09:00')).toBeNull();
    expect(screen.getByText('Personnalisé')).toBeTruthy();
  });

  it('« Personnalisé » part d’une heure à venir, jamais de 09:00 déjà passé', async () => {
    const now = new Date(2026, 9, 1, 10, 20);
    expect(defaultCustom('2026-10-01', now)).toBe(atTime('2026-10-01', '11:00').toISOString());
    expect(defaultCustom('2026-10-05', now)).toBe(atTime('2026-10-05', '09:00').toISOString());
    expect(isPast(defaultCustom(null, now), now)).toBe(false);
  });

  it('heure personnalisée passée : refusée avec un message clair', async () => {
    mockPermission.state = 'granted';
    const future = atTime('2026-10-01', '15:00').toISOString();
    await render(inApp(<Harness dueDate="2026-10-01" initial={future} />));
    await flush();
    expect(screen.queryByTestId('reminder-past')).toBeNull();
    changes.mockClear();
    // On choisit 08:00 aujourd'hui (il est 10:00) dans le sélecteur d'heure, puis « OK ».
    await fireEvent.press(screen.getByLabelText(/^Heure du rappel/));
    const picker = mockPickers.filter((p) => p.mode === 'time').at(-1);
    await act(async () => picker?.onChange?.({}, atTime('2026-10-01', '08:00')));
    const ok = screen.getAllByText('OK');
    await fireEvent.press(ok[ok.length - 1]!);
    expect(changes).not.toHaveBeenCalled();
    expect(screen.getByTestId('reminder-past')).toBeTruthy();
    expect(screen.getByText(i18n.t('reminder.pastError'))).toBeTruthy();
  });

  it('refus à l’enregistrement : le message traduit, jamais sa clé', async () => {
    mockPermission.state = 'granted';
    await render(
      inApp(
        <ReminderField
          dueDate="2026-10-10"
          value={atTime('2026-10-09', '18:00').toISOString()}
          onChange={changes}
          error="validation.reminderPast"
        />,
      ),
    );
    await flush();
    expect(screen.getByText(i18n.t('validation.reminderPast'))).toBeTruthy();
    expect(screen.queryByText('validation.reminderPast')).toBeNull();
  });

  it('rappel enregistré déjà passé : le champ le signale', async () => {
    mockPermission.state = 'granted';
    await render(inApp(<Harness initial={atTime('2026-09-30', '18:00').toISOString()} />));
    await flush();
    expect(screen.getByTestId('reminder-past')).toBeTruthy();
  });
});

/** Comme la fiche d'une tâche : le rappel suit l'échéance, qu'on peut effacer. */
function DatedHarness({ dueDate: initialDue = '2026-10-10' }: { dueDate?: string }) {
  const [dueDate, setDueDate] = useState<string | null>(initialDue);
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setValue((v) => shiftReminder(v, dueDate, null));
          setDueDate(null);
        }}
      >
        <Text>Effacer la date</Text>
      </Pressable>
      <ReminderField
        dueDate={dueDate}
        value={value}
        onChange={(v) => {
          changes(v);
          setValue(v);
        }}
      />
    </>
  );
}

describe('rappel : toujours visible quand il existe', () => {
  it('« La veille à 18:00 » puis date effacée : devient « Personnalisé », date et heure affichées', async () => {
    mockPermission.state = 'granted';
    await render(inApp(<DatedHarness />));
    await flush();
    await fireEvent.press(screen.getByText('La veille à 18:00'));
    expect(
      screen.getByRole('button', { name: 'La veille à 18:00' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.queryByLabelText(/^Heure du rappel/)).toBeNull();

    await fireEvent.press(screen.getByText('Effacer la date'));
    await flush();
    // Le rappel reste à son heure (le 9 octobre à 18:00) et se voit, modifiable.
    expect(
      screen.getByRole('button', { name: 'Personnalisé' }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByLabelText(/^Heure du rappel : 18:00/)).toBeTruthy();
    expect(screen.getByLabelText(/^Date du rappel/)).toBeTruthy();
    expect(screen.queryByText('La veille à 18:00')).toBeNull();
  });

  it('« Personnalisé » choisi sur un préréglage : les champs restent ouverts', async () => {
    mockPermission.state = 'granted';
    await render(inApp(<Harness initial={atTime('2026-10-09', '18:00').toISOString()} />));
    await flush();
    expect(screen.queryByLabelText(/^Heure du rappel/)).toBeNull();
    await fireEvent.press(screen.getByText('Personnalisé'));
    expect(screen.getByLabelText(/^Heure du rappel : 18:00/)).toBeTruthy();
    // Revenir à un préréglage referme les champs.
    await fireEvent.press(screen.getByText('Le jour même à 09:00'));
    expect(screen.queryByLabelText(/^Heure du rappel/)).toBeNull();
  });
});

describe('rappel : réglage coupé dans Réglages', () => {
  it('rappels de tâches coupés : une note le dit, avec un lien vers Réglages', async () => {
    mockPermission.state = 'granted';
    await setNotificationPreferences(mockDb, { ...defaultNotificationPreferences, tasks: false });
    await render(
      inApp(<Harness kind="task" initial={atTime('2026-10-09', '18:00').toISOString()} />),
    );
    await flush();
    expect(screen.getByTestId('reminder-setting-off')).toBeTruthy();
    expect(screen.getByText(i18n.t('reminder.settingOff.task'))).toBeTruthy();
    expect(screen.getByText('Ouvrir Réglages')).toBeTruthy();
  });

  it('rappels de tâches actifs, ou aucun rappel choisi : pas de note', async () => {
    mockPermission.state = 'granted';
    await render(
      inApp(<Harness kind="task" initial={atTime('2026-10-09', '18:00').toISOString()} />),
    );
    await flush();
    expect(screen.queryByTestId('reminder-setting-off')).toBeNull();
    await act(() =>
      setNotificationPreferences(mockDb, { ...defaultNotificationPreferences, tasks: false }),
    );
    await render(inApp(<Harness kind="task" />));
    await flush();
    expect(screen.queryByTestId('reminder-setting-off')).toBeNull();
  });
});
