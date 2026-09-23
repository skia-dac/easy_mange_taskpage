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
      if (r.actionIdentifier === ACTIONS.addTask) {
        return {
          pathname: '/work/form',
          params: { kind: 'task', subjectId: a.subjectId, fromCourse: '1' },
        };
      }
      // Notification touchée ou bouton « Ajouter un devoir » : le devoir, pré-rempli avec la matière.
      return {
        pathname: '/work/form',
        params: { kind: 'assignment', subjectId: a.subjectId, fromCourse: '1' },
      };
    case 'work':
      return { pathname: '/work/[id]', params: { id: a.id, kind: a.workKind } };
    case 'exam':
      return { pathname: '/exams/[id]', params: { id: a.id } };
    case 'event':
      return { pathname: '/events/form', params: { id: a.id } };
  }
}
