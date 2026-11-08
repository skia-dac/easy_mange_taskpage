/**
 * Une ligne de l'agenda est UN bouton pour le lecteur d'écran : l'étiquette de droite (« En
 * retard », « Urgent », compte à rebours, « Annulé ») doit faire partie de ce qu'il annonce.
 */
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ReactElement } from 'react';

import type { Exam, Occurrence, Subject } from '@/modules/academic';
import type { WorkItem } from '@/modules/productivity';
import { i18n } from '@/shared/i18n';
import { ListRow, rowAccessibilityLabel } from '@/shared/ui/ListRow';

import { CourseRow, ExamRow, WorkRow } from './AgendaRows';

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const now = new Date(2026, 8, 23, 14, 0); // mercredi 23 sept. 2026, 14:00
const subjects = new Map<string, Subject>([['s', { id: 's', name: 'Maths' } as Subject]]);
const show = (ui: ReactElement) => render(<GestureHandlerRootView>{ui}</GestureHandlerRootView>);

const work = (over: Partial<WorkItem> = {}): WorkItem => ({
  id: 'w',
  kind: 'task',
  title: 'Exposé',
  description: null,
  subjectId: null,
  dueDate: '2026-09-23',
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  reminderAt: null,
  repeat: 'none',
  estimatedMinutes: null,
  space: 'personal',
  ...over,
});

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('libellé composé des lignes', () => {
  it('titre, sous-titre puis étiquette ; un libellé imposé garde l’étiquette', () => {
    expect(rowAccessibilityLabel({ title: 'A', subtitle: 'B', trailingLabel: 'C' })).toBe(
      'A, B, C',
    );
    expect(rowAccessibilityLabel({ title: 'A', subtitle: null, trailingLabel: null })).toBe('A');
    expect(
      rowAccessibilityLabel({
        title: 'A',
        subtitle: 'B',
        trailingLabel: 'C',
        accessibilityLabel: 'X',
      }),
    ).toBe('X, C');
  });

  it('ListRow : l’étiquette de droite est lue avec la ligne', async () => {
    await show(
      <ListRow title="Loyer" subtitle="Demain" trailingLabel="−50 000" onPress={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Loyer, Demain, −50 000' })).toBeTruthy();
  });

  it('tâche en retard : « En retard » est annoncé', async () => {
    await show(
      <WorkRow item={work({ dueDate: '2026-09-21' })} subjects={subjects} now={now} showDate />,
    );
    const row = screen.getByRole('button', {
      name: new RegExp(`^Exposé, .*${i18n.t('status.overdue')}$`),
    });
    expect(row).toBeTruthy();
  });

  it('le type « Tâche » n’ouvre le sous-titre que dans une liste mêlée (showKind)', async () => {
    const task = work({ subjectId: 's' });
    const view = await show(<WorkRow item={task} subjects={subjects} now={now} />);
    expect(screen.getByRole('button', { name: /^Exposé, Maths/ })).toBeTruthy();
    await view.unmount();
    await show(<WorkRow item={task} subjects={subjects} now={now} showKind />);
    expect(
      screen.getByRole('button', {
        name: new RegExp(`^Exposé, ${i18n.t('calendarItem.task')} · Maths`),
      }),
    ).toBeTruthy();
  });

  it('tâche urgente : la priorité est annoncée', async () => {
    await show(<WorkRow item={work({ priority: 'urgent' })} subjects={subjects} now={now} />);
    expect(
      screen.getByRole('button', { name: new RegExp(`${i18n.t('priority.urgent')}$`) }),
    ).toBeTruthy();
  });

  it('examen : le compte à rebours est annoncé', async () => {
    const exam = { id: 'x', subjectId: 's', date: '2026-09-26', title: 'Partiel' } as Exam;
    await show(<ExamRow exam={exam} subjects={subjects} now={now} />);
    const row = screen.getByRole('button', { name: /^Examen · Maths, Partiel/ });
    const chip = screen.getByText(/3/);
    expect(row.props.accessibilityLabel.endsWith(chip.props.children)).toBe(true);
  });

  it('cours annulé : l’heure et « Annulé » sont annoncés', async () => {
    const occurrence = {
      seriesId: 'c',
      subjectId: 's',
      date: '2026-09-23',
      originalDate: '2026-09-23',
      startTime: '08:00',
      endTime: '10:00',
      status: 'cancelled',
      room: 'B12',
    } as Occurrence;
    await show(<CourseRow occurrence={occurrence} subjects={subjects} />);
    const row = screen.getByRole('button', { name: /^Maths, 08:00 – 10:00, / });
    expect(row.props.accessibilityLabel).toContain('B12');
    expect(row.props.accessibilityLabel.endsWith(i18n.t('occurrence.cancelled'))).toBe(true);
  });
});
