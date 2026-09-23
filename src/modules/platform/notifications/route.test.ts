import { routeForResponse } from './route';

const end = { kind: 'endOfCourse' as const, seriesId: 's', date: '2026-09-23', subjectId: 'mkt' };

describe('réponse à une notification de fin de cours (§76–79)', () => {
  it('« Ajouter un devoir » ouvre le devoir avec la matière pré-remplie', () => {
    expect(routeForResponse({ actionIdentifier: 'add_assignment', action: end })).toEqual({
      pathname: '/work/form',
      params: { kind: 'assignment', subjectId: 'mkt', fromCourse: '1' },
    });
  });

  it('« Ajouter une tâche » ouvre la tâche', () => {
    expect(routeForResponse({ actionIdentifier: 'add_task', action: end })).toMatchObject({
      params: { kind: 'task' },
    });
  });

  it('« Rien à ajouter » n’ouvre rien', () => {
    expect(routeForResponse({ actionIdentifier: 'nothing', action: end })).toBeNull();
  });

  it('un rappel de cours ouvre la séance du jour', () => {
    expect(
      routeForResponse({
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
        action: { kind: 'course', seriesId: 's', date: '2026-09-23' },
      }),
    ).toEqual({
      pathname: '/courses/[id]',
      params: { id: 's', date: '2026-09-23' },
    });
  });
});
