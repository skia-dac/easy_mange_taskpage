import { fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CourseSeries, Exam, Subject } from '@/modules/academic';
import type { WorkItem } from '@/modules/productivity';
import { filterBySpaces, type TodayData } from '@/projections';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { i18n } from '@/shared/i18n';

import TodayRoute from '../(tabs)/index';

// Les lignes de tâches se glissent : il faut la racine des gestes, comme dans l'app.
const TodayScreen = () => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    <GestureHandlerRootView>
      <TodayRoute />
    </GestureHandlerRootView>
  </SafeAreaProvider>
);

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
  estimatedMinutes: null,
  space: 'personal',
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
  timetableId: null,
};

let mockAgenda: TodayData = { series: [series], exams: [exam], work: [late], events: [] };
// Lecture de l'agenda : prête (par défaut), en cours, ou en échec.
let mockAgendaQuery: () => { data?: TodayData; loading: boolean; error: unknown } = () => ({
  data: mockAgenda,
  loading: false,
  error: null,
});
const mockRetry = jest.fn();
let mockSubjects: Subject[] = [subject];

jest.mock('@/projections', () => ({
  ...jest.requireActual('@/projections'),
  useAgendaData: () => ({ ...mockAgendaQuery(), retry: mockRetry }),
}));
jest.mock('@/hooks/useSubjects', () => ({
  useSubjects: () => ({
    subjects: mockSubjects,
    byId: new Map(mockSubjects.map((s) => [s.id, s])),
    loading: false,
  }),
}));
// Réglages (ordre des sections…) et checklists : valeurs par défaut dans ce test sans base.
jest.mock('@/shared/db', () => ({
  ...jest.requireActual('@/shared/db'),
  useDb: () => ({}),
  useLiveQuery: () => ({ data: undefined, loading: true, error: null }),
  useSharedLiveQuery: () => ({ data: undefined, loading: true, error: null }),
}));
jest.mock('@/hooks/useWeekStart', () => ({ useWeekStart: () => 1 }));
jest.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { firstName: 'Awa', lastName: 'Diallo' }, loading: false }),
}));

describe('écran Aujourd’hui', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('montre le cours en cours, le devoir en retard et l’examen proche', async () => {
    await render(<TodayScreen />);
    expect(screen.getByText('Ta journée')).toBeTruthy();
    expect(screen.getByText('SE TERMINE DANS 42 MIN')).toBeTruthy();
    expect(screen.getByText('maintenant')).toBeTruthy();
    expect(screen.getAllByText('Marketing stratégique').length).toBeGreaterThan(0);
    expect(screen.getByText('Étude de cas Marketing')).toBeTruthy();
    expect(screen.getByText('En retard')).toBeTruthy();
    expect(screen.getByText('19 j')).toBeTruthy();
    // La liste « À faire » est affichée : pas de tuile « À faire » qui la répète.
    expect(screen.queryByText('1 en retard')).toBeNull();
    expect(screen.getByText('TERMINÉES')).toBeTruthy();
  });

  it('état vide : aucune matière, aucun cours', async () => {
    mockAgenda = { series: [], exams: [], work: [], events: [] };
    mockSubjects = [];
    await render(<TodayScreen />);
    // Premier lancement : un seul bloc d'accueil, pas quatre états vides empilés.
    expect(screen.getByText('Ajoute ta première matière pour commencer.')).toBeTruthy();
    expect(screen.getByText('Ajouter une matière')).toBeTruthy();
    expect(screen.getByText('Nouvelle tâche')).toBeTruthy();
    expect(screen.getByText('Rien d’autre de prévu à une heure précise aujourd’hui.')).toBeTruthy();
    expect(screen.queryByText('Rien à faire pour le moment.')).toBeNull();
    expect(screen.queryByText('Aucun examen programmé.')).toBeNull();
    // Le coup d'œil reste là.
    expect(screen.getByText('Aucun examen prévu')).toBeTruthy();
  });

  it('dès la première matière, les sections reviennent avec leur état vide', async () => {
    mockAgenda = { series: [], exams: [], work: [], events: [] };
    mockSubjects = [subject];
    await render(<TodayScreen />);
    expect(screen.queryByText('Ajoute ta première matière pour commencer.')).toBeNull();
    expect(screen.getByText('Rien à faire pour le moment.')).toBeTruthy();
    mockSubjects = [];
  });

  it('en anglais', async () => {
    await i18n.changeLanguage('en');
    await render(<TodayScreen />);
    expect(screen.getByText('Nothing else planned at a set time today.')).toBeTruthy();
  });

  it('le + ouvre les ajouts rapides', async () => {
    await render(<TodayScreen />);
    await fireEvent.press(screen.getByLabelText('Ajouter'));
    expect(screen.getByText('Dépense')).toBeTruthy();
    expect(screen.getByText('Entrée d’argent')).toBeTruthy();
    // Sans prochain cours (agenda vide du test précédent), la note n'est pas « de cours ».
    expect(screen.getByText('Note')).toBeTruthy();
    expect(screen.getByText('Autre (examen, cours…)')).toBeTruthy();
    await fireEvent.press(screen.getAllByLabelText('Fermer')[0]!);
    expect(screen.queryByText('Dépense')).toBeNull();
  });

  it('Pro seul : tuiles du travail, ni argent, ni cours, ni devoirs', async () => {
    const pro: WorkItem = {
      ...late,
      id: 'w2',
      kind: 'task',
      subjectId: null,
      title: 'Préparer la démo',
      space: 'work',
    };
    mockAgenda = filterBySpaces(
      { series: [series], exams: [exam], work: [late, pro], events: [] },
      ['work'],
    );
    await render(
      <SpacesContext.Provider value={spacesValue(['work'])}>
        <TodayScreen />
      </SpacesContext.Provider>,
    );
    expect(screen.getByText('À PLANIFIER')).toBeTruthy();
    expect(screen.getByText('RÉUNIONS')).toBeTruthy();
    expect(screen.getByText('Préparer la démo')).toBeTruthy();
    expect(screen.queryByText('ARGENT')).toBeNull();
    expect(screen.queryByText('Marketing stratégique')).toBeNull();
    expect(screen.queryByText('Étude de cas Marketing')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ajouter'));
    expect(screen.queryByText('Dépense')).toBeNull();
    expect(screen.getByText('Rendez-vous')).toBeTruthy();
  });

  it('chargement : des lignes fantômes, pas une liste vide', async () => {
    mockAgendaQuery = () => ({ data: undefined, loading: true, error: null });
    await render(<TodayScreen />);
    expect(screen.getByLabelText('Chargement…')).toBeTruthy();
    expect(screen.queryByText('Rien à faire pour le moment.')).toBeNull();
  });

  it('échec de lecture : un vrai message et « Réessayer »', async () => {
    mockAgendaQuery = () => ({ data: undefined, loading: false, error: new Error('disk') });
    await render(<TodayScreen />);
    expect(screen.getByText('Impossible d’afficher cette liste')).toBeTruthy();
    expect(screen.queryByText('Rien à faire pour le moment.')).toBeNull();
    await fireEvent.press(screen.getByText('Réessayer'));
    expect(mockRetry).toHaveBeenCalled();
  });

  it('Pro sans rien encore : une première action guidée', async () => {
    mockAgendaQuery = () => ({
      data: { series: [], exams: [], work: [], events: [] },
      loading: false,
      error: null,
    });
    await render(
      <SpacesContext.Provider value={spacesValue(['work'])}>
        <TodayScreen />
      </SpacesContext.Provider>,
    );
    expect(screen.getByText('Commence ta semaine de travail')).toBeTruthy();
    expect(screen.getByText('Nouvelle tâche')).toBeTruthy();
    expect(screen.getByText('Nouveau rendez-vous')).toBeTruthy();
  });

  it('Perso seul sans rien encore : tâche ou habitude', async () => {
    await render(
      <SpacesContext.Provider value={spacesValue(['personal'])}>
        <TodayScreen />
      </SpacesContext.Provider>,
    );
    expect(screen.getByText('Organise ta vie perso')).toBeTruthy();
    expect(screen.getByText('Nouvelle habitude')).toBeTruthy();
  });
});
