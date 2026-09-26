/**
 * Test « fumée » : chaque écran s'affiche sans planter, avec de vraies données dans une vraie
 * base SQLite, et montre le texte attendu. C'est le filet qui attrape les liens cassés entre modules.
 */
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ComponentType } from 'react';

import {
  cancelOccurrence,
  createCourse,
  createExam,
  createOffPeriod,
  createSubject,
  createTimetable,
} from '@/modules/academic';
import { createGoal, createLoan, createRecurring, createTransaction } from '@/modules/finance';
import { saveProfile } from '@/modules/identity';
import {
  addHabitCount,
  addSubtask,
  createHabit,
  createRevisionBlock,
  createNote,
  createNoteCategory,
  createPersonalEvent,
  createSlot,
  createWorkItem,
  endStudySession,
  saveMoodLog,
  setHabitDone,
  setHabitMissed,
  startStudySession,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { createTestDb } from '@/test/memoryDb';

let mockDb: Db & { close(): void };
const mockParams: Record<string, string> = {};

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => mockDb }));
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      dismissAll: jest.fn(),
      canGoBack: () => true,
      canDismiss: () => true,
    },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void | (() => void)) => React.useEffect(effect, [effect]),
    Stack: { Screen: () => null },
    Tabs: Object.assign(
      ({ children }: { children: React.ReactNode }) =>
        React.createElement(React.Fragment, null, children),
      { Screen: () => null },
    ),
    Redirect: () => null,
    Link: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
const signedOut = { enabled: false, loading: false, session: null, userId: null, email: null };
let mockAuth: Record<string, unknown> = signedOut;
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  useAuth: () => mockAuth,
}));
jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  hasPermission: async () => true,
  ensurePermission: async () => true,
}));
jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) }); // mercredi 23 sept. 2026

const ids: Record<string, string> = {};

beforeAll(async () => {
  await i18n.changeLanguage('fr');
  mockDb = await createTestDb();
  await saveProfile(mockDb, { firstName: 'Awa', lastName: 'Diallo' });
  ids.subject = await createSubject(mockDb, {
    name: 'Marketing stratégique',
    colorId: 'violet',
    teacher: 'Prof. Martin',
    room: 'B12',
  });
  ids.timetable = await createTimetable(mockDb, {
    name: 'Semestre 1',
    validFrom: '2026-09-01',
    validUntil: '2026-12-20',
  });
  ids.course = await createCourse(mockDb, {
    subjectId: ids.subject,
    timetableId: ids.timetable,
    courseType: 'lecture',
    recurrence: 'weekly',
    weekday: 3,
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    startTime: '09:00',
    endTime: '11:00',
    room: 'B12',
  });
  await cancelOccurrence(mockDb, ids.course, '2026-09-30');
  ids.exam = await createExam(mockDb, {
    subjectId: ids.subject,
    date: '2026-10-12',
    time: '09:00',
    room: 'Amphi B',
    reminderDays: [7, 1],
    reminderTime: '09:00',
  });
  await createExam(mockDb, {
    subjectId: ids.subject,
    title: 'Contrôle continu',
    date: '2026-09-15',
    grade: 14.5,
    gradeMax: 20,
    coefficient: 2,
  });
  const study = await startStudySession(mockDb, {
    subjectId: ids.subject,
    startedAt: '2026-09-22T08:00:00.000Z',
    plannedMinutes: 25,
  });
  await endStudySession(mockDb, study, '2026-09-22T08:25:00.000Z');
  ids.habit = await createHabit(mockDb, {
    name: 'Faire du sport',
    icon: 'activity',
    colorId: 'green',
    tracksBody: true,
  });
  ids.water = await createHabit(mockDb, {
    name: 'Boire de l’eau',
    icon: 'droplet',
    target: 8,
    unit: 'verres',
  });
  await setHabitDone(mockDb, ids.habit, '2026-09-21', true);
  await setHabitMissed(mockDb, ids.habit, '2026-09-22', 'missed', 'tired', 'Nuit courte');
  await addHabitCount(mockDb, ids.water, '2026-09-23', 3);
  ids.task = await createWorkItem(mockDb, 'task', {
    title: 'Réviser le chapitre 3',
    dueDate: '2026-09-23',
    priority: 'normal',
    status: 'todo',
    subjectId: ids.subject,
  });
  ids.assignment = await createWorkItem(mockDb, 'assignment', {
    title: 'Étude de cas Marketing',
    dueDate: '2026-09-22',
    priority: 'important',
    status: 'todo',
    subjectId: ids.subject,
  });
  await addSubtask(mockDb, 'task', ids.task, 'Lire le résumé');
  ids.revision = await createRevisionBlock(mockDb, {
    subjectId: ids.subject,
    examId: ids.exam,
    date: '2026-09-23',
    startTime: '17:00',
    endTime: '18:00',
    title: 'Chapitres 1 à 3',
  });
  await saveMoodLog(mockDb, { date: '2026-09-22', mood: 4, energy: 3 });
  const XAF = 'XAF';
  await createTransaction(mockDb, {
    kind: 'income',
    amountMinor: 200000,
    currency: XAF,
    date: '2026-09-01',
    categoryId: 'family_in',
  });
  ids.expense = await createTransaction(mockDb, {
    kind: 'expense',
    amountMinor: 1500,
    currency: XAF,
    date: '2026-09-23',
    categoryId: 'food',
    note: 'Déjeuner',
  });
  ids.charge = await createRecurring(mockDb, {
    kind: 'charge',
    name: 'Loyer',
    categoryId: 'home',
    amountMinor: 35000,
    currency: XAF,
    frequency: 'monthly',
    dayOfMonth: 28,
    startDate: '2026-09-01',
    reminders: [1440],
  });
  ids.tontine = await createRecurring(mockDb, {
    kind: 'tontine',
    name: 'Tontine du quartier',
    amountMinor: 5000,
    currency: XAF,
    frequency: 'weekly',
    weekday: 6,
    time: '15:00',
    reminders: [1440, 180],
    startDate: '2026-09-01',
    payoutDate: '2026-10-10',
    payoutMinor: 60000,
  });
  ids.goal = await createGoal(mockDb, { name: 'Téléphone', targetMinor: 150000, currency: XAF });
  await createTransaction(mockDb, {
    kind: 'saving',
    amountMinor: 20000,
    currency: XAF,
    date: '2026-09-05',
    goalId: ids.goal,
  });
  ids.loan = await createLoan(
    mockDb,
    { direction: 'lent', person: 'Kevin' },
    { amountMinor: 10000, currency: XAF, date: '2026-09-10' },
  );
  ids.event = await createPersonalEvent(mockDb, {
    title: 'Réunion asso',
    date: '2026-09-23',
    startTime: '18:00',
  });
  ids.note = await createNote(mockDb, {
    title: 'Les 4P',
    content: '# Cours\n- **produit**\n[ ] relire',
    subjectId: ids.subject,
    courseSeriesId: ids.course,
    courseDate: '2026-09-23',
  });
  ids.off = await createOffPeriod(mockDb, {
    name: 'Toussaint',
    kind: 'holiday',
    startDate: '2026-10-24',
    endDate: '2026-11-02',
    suspendCourses: true,
  });
  ids.slot = await createSlot(mockDb, {
    title: 'Garde de nuit',
    weekdays: [1, 3],
    startTime: '22:00',
    endTime: '06:00',
    rotation: 'A',
    validFrom: '2026-09-01',
    // Le test tourne avec les espaces par défaut (Études + Perso) : le créneau doit être visible.
    space: 'personal',
  });
  ids.noteCategory = await createNoteCategory(mockDb, { name: 'Idées', colorId: 'green' });
});
afterAll(() => mockDb.close());

type Case = {
  name: string;
  load: () => { default: ComponentType };
  params?: Record<string, string>;
  /** État de connexion simulé (par défaut : comptes pas configurés). */
  auth?: Record<string, unknown>;
  expect: string[];
};

const enabledOut = { ...signedOut, enabled: true };
const signedIn = {
  enabled: true,
  loading: false,
  session: { user: { id: 'user-1', email: 'awa@example.com' } },
  userId: 'user-1',
  email: 'awa@example.com',
};

const cases: Case[] = [
  {
    name: 'Aujourd’hui',
    load: () => require('@/app/(tabs)/index') as { default: ComponentType },
    expect: [
      'Bonjour Awa',
      'Ta journée',
      'maintenant',
      'Habitudes du jour',
      'Mes habitudes du jour',
      'Boire de l’eau',
      'Étude de cas Marketing',
      'Réunion asso',
      '19 j',
      'Chapitres 1 à 3',
      'Personnaliser cet écran',
      'ARGENT',
      '1 en retard',
    ],
  },
  {
    name: 'Calendrier',
    load: () => require('@/app/(tabs)/calendar') as { default: ComponentType },
    expect: ['Septembre 2026', 'Marketing stratégique'],
  },
  {
    name: 'Notes',
    load: () => require('@/app/(tabs)/notes') as { default: ComponentType },
    expect: ['Les 4P'],
  },
  {
    name: 'Tâches',
    load: () => require('@/app/(tabs)/tasks') as { default: ComponentType },
    expect: ['Étude de cas Marketing', 'En retard'],
  },
  {
    name: 'Profil',
    load: () => require('@/app/profile/index') as { default: ComponentType },
    expect: ['Awa Diallo', 'Marketing stratégique', 'Réglages'],
  },
  {
    name: 'Matières',
    load: () => require('@/app/subjects/index') as { default: ComponentType },
    expect: ['Marketing stratégique', 'Prof. Martin'],
  },
  {
    name: 'Détail matière',
    load: () => require('@/app/subjects/[id]') as { default: ComponentType },
    params: { id: 'subject' },
    expect: ['Marketing stratégique', 'Les 4P', 'Étude de cas Marketing', 'Prochain'],
  },
  {
    name: 'Formulaire matière',
    load: () => require('@/app/subjects/form') as { default: ComponentType },
    params: { id: 'subject' },
    expect: ['Enregistrer la matière'],
  },
  {
    name: 'Emplois du temps',
    load: () => require('@/app/timetables/index') as { default: ComponentType },
    expect: ['Semestre 1', 'Actif', 'Marketing stratégique'],
  },
  {
    name: 'Formulaire emploi du temps',
    load: () => require('@/app/timetables/form') as { default: ComponentType },
    params: { id: 'timetable' },
    expect: ['Semestre 1'],
  },
  {
    name: 'Détail cours',
    load: () => require('@/app/courses/[id]') as { default: ComponentType },
    params: { id: 'course', date: '2026-09-23' },
    expect: ['Marketing stratégique', 'Prendre des notes', 'Les 4P'],
  },
  {
    name: 'Détail cours annulé',
    load: () => require('@/app/courses/[id]') as { default: ComponentType },
    params: { id: 'course', date: '2026-09-30' },
    expect: ['Annulé', 'Rétablir ce cours'],
  },
  {
    name: 'Formulaire cours',
    load: () => require('@/app/courses/form') as { default: ComponentType },
    params: { id: 'course' },
    expect: ['Enregistrer le cours', 'cours dans ton calendrier'],
  },
  {
    name: 'Modifier une séance',
    load: () => require('@/app/courses/occurrence') as { default: ComponentType },
    params: { seriesId: 'course', date: '2026-09-23' },
    expect: ['Enregistrer pour ce jour'],
  },
  {
    name: 'Calendrier heures',
    load: () => require('@/app/(tabs)/calendar') as { default: ComponentType },
    params: { mode: 'hours' },
    expect: ['Heures', 'Appui long sur un élément', 'Tâches et devoirs'],
  },
  {
    name: 'Argent',
    load: () => require('@/app/(tabs)/money') as { default: ComponentType },
    expect: [
      'IL TE RESTE',
      'Loyer',
      'Tontine du quartier',
      'Nourriture',
      'Ton tour : Tontine du quartier',
    ],
  },
  {
    name: 'Saisie rapide',
    load: () => require('@/app/money/add') as { default: ComponentType },
    params: { kind: 'expense' },
    expect: [
      'Nourriture',
      'Chaussures',
      'Aujourd’hui, par défaut. Touche la date si c’était un autre jour.',
    ],
  },
  {
    name: 'Modifier une opération',
    load: () => require('@/app/money/add') as { default: ComponentType },
    params: { id: 'expense' },
    expect: ['Supprimer cette opération'],
  },
  {
    name: 'Historique argent',
    load: () => require('@/app/money/history') as { default: ComponentType },
    expect: ['Déjeuner', 'Entrées'],
  },
  {
    name: 'Bilan argent',
    load: () => require('@/app/money/report') as { default: ComponentType },
    expect: ['Où part ton argent', 'Nourriture', 'D’où vient ton argent'],
  },
  {
    name: 'Charges fixes',
    load: () => require('@/app/money/recurring') as { default: ComponentType },
    expect: ['Loyer', 'Tontine du quartier', 'Le 28 de chaque mois'],
  },
  {
    name: 'Formulaire tontine',
    load: () => require('@/app/money/recurring-form') as { default: ComponentType },
    params: { id: 'tontine' },
    expect: ['Ton tour', 'Compter automatiquement comme entrée', 'la veille'],
  },
  {
    name: 'Épargne',
    load: () => require('@/app/money/goals') as { default: ComponentType },
    expect: ['Téléphone', 'Mettre de côté'],
  },
  {
    name: 'Objectif',
    load: () => require('@/app/money/goal-form') as { default: ComponentType },
    params: { id: 'goal' },
    expect: ['Enregistrer l’objectif'],
  },
  {
    name: 'Prêts',
    load: () => require('@/app/money/loans') as { default: ComponentType },
    expect: ['Kevin', 'On m’a rendu…'],
  },
  {
    name: 'Nouveau prêt',
    load: () => require('@/app/money/loan-form') as { default: ComponentType },
    expect: ['Prêté à'],
  },
  {
    name: 'Réglages argent',
    load: () => require('@/app/money/settings') as { default: ComponentType },
    expect: ['Ta période de budget', 'Masquer les montants dans les widgets', 'Nouvelle catégorie'],
  },
  {
    name: 'Bilan du soir',
    load: () => require('@/app/review') as { default: ComponentType },
    expect: ['Ce qui reste', 'Réviser le chapitre 3', 'Tout reporter à demain (2)', 'Humeur'],
  },
  {
    name: 'Humeur et énergie',
    load: () => require('@/app/mood') as { default: ComponentType },
    expect: ['7 derniers jours', 'Dernières entrées', 'Tes habitudes et ton énergie'],
  },
  {
    name: 'Sections d’Aujourd’hui',
    load: () => require('@/app/today-layout') as { default: ComponentType },
    expect: ['Prochain cours', 'Révisions du jour', 'Revenir à l’ordre par défaut'],
  },
  {
    name: 'Plan de révision',
    load: () => require('@/app/revision/plan') as { default: ComponentType },
    params: { examId: 'exam' },
    expect: ['Séances proposées', 'Ajouter au calendrier'],
  },
  {
    name: 'Détail révision',
    load: () => require('@/app/revision/[id]') as { default: ComponentType },
    params: { id: 'revision' },
    expect: ['Chapitres 1 à 3', 'Commencer la révision', 'Pour l’examen'],
  },
  {
    name: 'Formulaire révision',
    load: () => require('@/app/revision/form') as { default: ComponentType },
    params: { id: 'revision' },
    expect: ['Enregistrer la révision'],
  },
  {
    name: 'Vacances',
    load: () => require('@/app/off-periods/index') as { default: ComponentType },
    expect: ['Toussaint', 'Cours suspendus'],
  },
  {
    name: 'Formulaire vacances',
    load: () => require('@/app/off-periods/form') as { default: ComponentType },
    params: { id: 'off' },
    expect: ['Toussaint', 'séance ne s’affichera pas'],
  },
  {
    name: 'Détail devoir',
    load: () => require('@/app/work/[id]') as { default: ComponentType },
    params: { id: 'assignment', kind: 'assignment' },
    expect: ['Étude de cas Marketing', 'En retard', 'Marquer comme terminé'],
  },
  {
    name: 'Formulaire tâche',
    load: () => require('@/app/work/form') as { default: ComponentType },
    params: { id: 'task', kind: 'task' },
    expect: ['Enregistrer la tâche', 'Rappel', 'Durée estimée'],
  },
  {
    name: 'Détail tâche avec étapes',
    load: () => require('@/app/work/[id]') as { default: ComponentType },
    params: { id: 'task', kind: 'task' },
    expect: ['Réviser le chapitre 3', 'Lire le résumé', '0/1 étapes', 'Reporter'],
  },
  {
    name: 'Détail examen',
    load: () => require('@/app/exams/[id]') as { default: ComponentType },
    params: { id: 'exam' },
    expect: ['Marketing stratégique', 'Dans 19 jours', 'Amphi B', 'Pas encore noté'],
  },
  {
    name: 'Formulaire examen',
    load: () => require('@/app/exams/form') as { default: ComponentType },
    params: { id: 'exam' },
    expect: ['Enregistrer l’examen', '7 jours avant'],
  },
  {
    name: 'Formulaire événement',
    load: () => require('@/app/events/form') as { default: ComponentType },
    params: { id: 'event' },
    expect: ['Réunion asso', 'Enregistrer l’événement'],
  },
  {
    name: 'Note',
    load: () => require('@/app/notes/[id]') as { default: ComponentType },
    params: { id: 'note' },
    expect: ['Les 4P', 'produit', 'relire'],
  },
  {
    name: 'Nouvelle note depuis un cours',
    load: () => require('@/app/notes/[id]') as { default: ComponentType },
    params: {
      id: 'new',
      subjectId: 'subject',
      courseSeriesId: 'course',
      courseDate: '2026-09-23',
    },
    expect: ['Marketing stratégique — mer. 23 sept.'],
  },
  {
    name: 'Ajout rapide',
    load: () => require('@/app/add') as { default: ComponentType },
    expect: ['Devoir', 'Examen', 'Note', 'Cours'],
  },
  {
    name: 'Recherche',
    load: () => require('@/app/search') as { default: ComponentType },
    expect: ['Tape au moins 2 caractères.'],
  },
  {
    name: 'Notifications',
    load: () => require('@/app/notifications') as { default: ComponentType },
    expect: ['rappels dans les'],
  },
  {
    name: 'Réglages',
    load: () => require('@/app/settings') as { default: ComponentType },
    expect: [
      'Rappels de cours',
      'Apparence',
      'Langue',
      'Mode focus',
      'Verrouiller MySky',
      'Politique de confidentialité',
      'Couleur principale',
      'Taille du texte',
      'Bilan du soir',
      'Sections d’Aujourd’hui',
    ],
  },
  {
    name: 'Profil — modifier',
    load: () => require('@/app/profile/edit') as { default: ComponentType },
    expect: ['Enregistrer le profil'],
  },
  {
    name: 'Notes d’examen',
    load: () => require('@/app/grades') as { default: ComponentType },
    expect: ['MOYENNE GÉNÉRALE', '14,5', 'Contrôle continu'],
  },
  {
    name: 'Révision',
    load: () => require('@/app/study') as { default: ComponentType },
    expect: ['Lancer une session', '25 min'],
  },
  {
    name: 'Statistiques',
    load: () => require('@/app/stats') as { default: ComponentType },
    expect: ['Heures de cours', 'Série', 'Habitudes respectées'],
  },
  {
    name: 'Mes habitudes',
    load: () => require('@/app/habits/index') as { default: ComponentType },
    expect: ['Faire du sport', '3 / 8 verres', 'Fatigue', 'Nuit courte', 'Suggestions'],
  },
  {
    name: 'Détail habitude',
    load: () => require('@/app/habits/[id]') as { default: ComponentType },
    params: { id: 'habit' },
    expect: [
      'Faire du sport',
      'Tous les jours',
      'Jours manqués et excusés',
      'Nuit courte',
      'Ma progression physique',
    ],
  },
  {
    name: 'Formulaire habitude',
    load: () => require('@/app/habits/form') as { default: ComponentType },
    params: { id: 'habit' },
    expect: ['Enregistrer l’habitude', 'Cocher avec la révision'],
  },
  {
    name: 'Politique de confidentialité',
    load: () => require('@/app/privacy') as { default: ComponentType },
    expect: [
      'Sans compte, tes données restent',
      'loi n° 2024/017',
      'Sopgwi Kamga Yvan Armel',
      'Compte et synchronisation',
    ],
  },
  {
    name: 'Compte — comptes pas configurés',
    load: () => require('@/app/account/index') as { default: ComponentType },
    expect: ['Comptes pas encore disponibles'],
  },
  {
    name: 'Compte — pas connecté',
    load: () => require('@/app/account/index') as { default: ComponentType },
    auth: enabledOut,
    expect: ['Retrouve tes données partout', 'Créer mon compte', 'Le compte est facultatif'],
  },
  {
    name: 'Compte — connecté',
    load: () => require('@/app/account/index') as { default: ComponentType },
    auth: signedIn,
    expect: [
      'awa@example.com',
      'Synchroniser maintenant',
      'Supprimer mon compte',
      'Se déconnecter',
    ],
  },
  {
    name: 'Connexion',
    load: () => require('@/app/auth/sign-in') as { default: ComponentType },
    auth: enabledOut,
    expect: [
      'Se connecter',
      'Mot de passe oublié ?',
      'Continuer avec Apple',
      'Continuer avec Google',
    ],
  },
  {
    name: 'Inscription',
    load: () => require('@/app/auth/sign-up') as { default: ComponentType },
    auth: enabledOut,
    expect: ['Créer mon compte', 'Confirmer le mot de passe', 'Au moins 8 caractères'],
  },
  {
    name: 'Mot de passe oublié',
    load: () => require('@/app/auth/forgot') as { default: ComponentType },
    auth: enabledOut,
    expect: ['Envoyer le lien'],
  },
  {
    name: 'Nouveau mot de passe',
    load: () => require('@/app/auth/reset') as { default: ComponentType },
    auth: signedIn,
    expect: ['Enregistrer le mot de passe'],
  },
  {
    name: 'Onboarding',
    load: () => require('@/app/onboarding') as { default: ComponentType },
    expect: ['Sache toujours ce qui t’attend'],
  },
  {
    name: 'Point de départ (photo et poids)',
    load: () => require('@/app/habits/checkpoint') as { default: ComponentType },
    params: { habitId: 'habit' },
    expect: ['Prendre une photo', 'Poids (kg)'],
  },
  {
    name: 'Mon planning',
    load: () => require('@/app/planning/index') as { default: ComponentType },
    expect: ['Ma semaine type', 'Garde de nuit', 'Copier la semaine dernière'],
  },
  {
    name: 'Créneau fixe',
    load: () => require('@/app/planning/slot-form') as { default: ComponentType },
    params: { id: 'slot' },
    expect: ['Garde de nuit', 'Semaines A'],
  },
  {
    name: 'Catégories de notes',
    load: () => require('@/app/notes/categories') as { default: ComponentType },
    expect: ['Idées', 'Nouvelle catégorie'],
  },
  {
    name: 'Formulaire catégorie de notes',
    load: () => require('@/app/notes/category-form') as { default: ComponentType },
    params: { id: 'noteCategory' },
    expect: ['Idées'],
  },
  {
    name: 'Page introuvable',
    load: () => require('@/app/+not-found') as { default: ComponentType },
    expect: ['Cette page n’existe pas.'],
  },
];

describe.each(cases)('écran $name', (c) => {
  it('s’affiche avec ses données', async () => {
    mockAuth = c.auth ?? signedOut;
    for (const k of Object.keys(mockParams)) delete mockParams[k];
    for (const [k, v] of Object.entries(c.params ?? {}))
      mockParams[k] = k.toLowerCase().endsWith('id') ? (ids[v] ?? v) : v;
    const { default: Screen } = c.load();
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <GestureHandlerRootView>
          <Screen />
        </GestureHandlerRootView>
      </SafeAreaProvider>,
    );
    for (const text of c.expect) {
      const re = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      // Texte affiché, ou valeur d'un champ de saisie (formulaires).
      const found = await screen
        .findAllByText(re, {}, { timeout: 3000 })
        .catch(() => screen.findAllByDisplayValue(re, {}, { timeout: 3000 }));
      expect(found.length).toBeGreaterThan(0);
    }
  });
});
