import { render, screen } from '@testing-library/react-native';

import type { CourseSeries, Exam, Subject } from '@/modules/academic';
import type { WorkItem } from '@/modules/productivity';
import type { TodayData } from '@/projections';
import { i18n } from '@/shared/i18n';

import TodayScreen from '../(tabs)/index';

// Mercredi 23 septembre 2026, 10:18 : le cours de 09:00 à 11:00 est en cours.
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });

const subject: Subject = {
  id: 'mkt',
  name: 'Marketing stratégique',
  code: null,
  teacher: 'Prof. Martin',
  room: 'B12',
  colorId: 'violet',
  semester: null,
  description: null,
  createdAt: '',
  updatedAt: '',
};
const series: CourseSeries = {
  id: 's1',
  subjectId: 'mkt',
  timetableId: null,
  title: null,
  teacher: 'Prof. Martin',
  room: 'B12',
  courseType: 'lecture',
  recurrence: 'weekly',
  weekday: 3,
  validFrom: '2026-09-01',
  validUntil: '2026-12-20',
  startTime: '09:00',
  endTime: '11:00',
  description: null,
  reminderMinutes: null,
};
const late: WorkItem = {
  id: 'w1',
  kind: 'assignment',
  title: 'Étude de cas Marketing',
  description: null,
  subjectId: 'mkt',
  dueDate: '2026-09-22',
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  reminderAt: null,
  repeat: 'none',
};
const exam: Exam = {
  id: 'e1',
  subjectId: 'mkt',
  title: null,
  date: '2026-10-12',
  time: '09:00',
  durationMinutes: null,
  room: null,
  description: null,
  reminderDays: [],
  reminderTime: '09:00',
  grade: null,
  gradeMax: 20,
  coefficient: 1,
};

let mockAgenda: TodayData = { series: [series], exams: [exam], work: [late], events: [] };
let mockSubjects: Subject[] = [subject];

jest.mock('@/projections', () => ({
  ...jest.requireActual('@/projections'),
  useAgendaData: () => ({ data: mockAgenda, loading: false, error: null }),
}));
jest.mock('@/hooks/useSubjects', () => ({
  useSubjects: () => ({
    subjects: mockSubjects,
    byId: new Map(mockSubjects.map((s) => [s.id, s])),
    loading: false,
  }),
}));
jest.mock('@/shared/db', () => ({ ...jest.requireActual('@/shared/db'), useDb: () => ({}) }));
jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { firstName: 'Awa', lastName: 'Diallo' }, loading: false }),
}));

describe('écran Aujourd’hui', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('montre le cours en cours, le devoir en retard et l’examen proche', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('COURS EN COURS')).toBeTruthy();
    expect(screen.getByText('Se termine dans 42 min')).toBeTruthy();
    expect(screen.getAllByText('Marketing stratégique').length).toBeGreaterThan(0);
    expect(screen.getByText('Étude de cas Marketing')).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByText('Dans 19 jours')).toBeTruthy();
  });

  it('état vide : aucune matière, aucun cours', async () => {
    mockAgenda = { series: [], exams: [], work: [], events: [] };
    mockSubjects = [];
    await render(<TodayScreen />);
    expect(screen.getByText('Ajoute ta première matière pour commencer.')).toBeTruthy();
    expect(screen.getByText('Aucun cours prévu aujourd’hui.')).toBeTruthy();
    expect(screen.getByText('Rien à faire pour le moment.')).toBeTruthy();
    expect(screen.getByText('Aucun examen programmé.')).toBeTruthy();
  });

  it('en anglais', async () => {
    await i18n.changeLanguage('en');
    await render(<TodayScreen />);
    expect(screen.getByText('No classes today.')).toBeTruthy();
  });
});
