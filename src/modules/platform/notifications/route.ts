import type { Href } from 'expo-router';

import { ACTIONS, type NotificationResponse } from './scheduler';

/** Où aller quand l'utilisateur répond à une notification (§77–79). null = ne rien ouvrir. */
export function routeForResponse(r: NotificationResponse): Href | null {
  const a = r.action;
  switch (a.kind) {
    case 'course':
      return { pathname: '/courses/[id]', params: { id: a.seriesId, date: a.date } };
    case 'endOfCourse':
      if (r.actionIdentifier === ACTIONS.nothing) return null;
      if (r.actionIdentifier === ACTIONS.addNote) {
        // Note pré-remplie avec la matière et la date du cours (§78).
        return {
          pathname: '/notes/[id]',
          params: {
            id: 'new',
            subjectId: a.subjectId,
            courseSeriesId: a.seriesId,
            courseDate: a.date,
          },
        };
      }
      // « Ajouter une tâche », l'ancien bouton « Ajouter un devoir » (notifications déjà
      // programmées) ou la notification touchée : la fiche unique de tâche, avec la matière du
      // cours pré-remplie (une tâche avec une matière est un devoir).
      return {
        pathname: '/work/form',
        params: { subjectId: a.subjectId, fromCourse: '1' },
      };
    case 'work':
      return { pathname: '/work/[id]', params: { id: a.id, kind: a.workKind } };
    case 'exam':
      return { pathname: '/exams/[id]', params: { id: a.id } };
    case 'event':
      return { pathname: '/events/form', params: { id: a.id } };
    case 'study':
      return '/study';
    case 'habit':
      return { pathname: '/habits/[id]', params: { id: a.id } };
    case 'revision':
      return { pathname: '/revision/[id]', params: { id: a.id } };
    case 'review':
      return '/review';
    case 'money':
      return { pathname: '/money/recurring-form', params: { id: a.id } };
  }
}
