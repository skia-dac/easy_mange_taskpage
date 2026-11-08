import { routeForResponse } from './route';

const end = { kind: 'endOfCourse' as const, seriesId: 's', date: '2026-09-23', subjectId: 'mkt' };

it('le filet de sécurité « Ouvre MySky… » ouvre Aujourd’hui', () => {
  expect(
    routeForResponse({
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      action: { kind: 'refresh' },
    }),
  ).toBe('/(tabs)');
});

describe('réponse à une notification de fin de cours (§76–79)', () => {
  it('« Ajouter une tâche » ouvre la fiche unique de tâche, matière pré-remplie', () => {
    expect(routeForResponse({ actionIdentifier: 'add_task', action: end })).toEqual({
      pathname: '/work/form',
      params: { subjectId: 'mkt', fromCourse: '1' },
    });
  });

  it('l’ancien bouton « Ajouter un devoir » et la notification touchée ouvrent la même fiche', () => {
    const unified = { pathname: '/work/form', params: { subjectId: 'mkt', fromCourse: '1' } };
    expect(routeForResponse({ actionIdentifier: 'add_assignment', action: end })).toEqual(unified);
    expect(
      routeForResponse({
        actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
        action: end,
      }),
    ).toEqual(unified);
  });

  it('« Ajouter une note » ouvre une note pré-remplie (§78)', () => {
    expect(routeForResponse({ actionIdentifier: 'add_note', action: end })).toEqual({
      pathname: '/notes/[id]',
      params: { id: 'new', subjectId: 'mkt', courseSeriesId: 's', courseDate: '2026-09-23' },
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

describe('rappels sans écran de lecture', () => {
  const tap = 'expo.modules.notifications.actions.DEFAULT';

  it('charge ou tontine : la liste, la ligne mise en avant (pas la fiche de modification)', () => {
    expect(
      routeForResponse({ actionIdentifier: tap, action: { kind: 'money', id: 'r1' } }),
    ).toEqual({ pathname: '/money/recurring', params: { highlight: 'r1' } });
  });

  it('rendez-vous : sa fiche, comme partout dans l’app', () => {
    expect(
      routeForResponse({ actionIdentifier: tap, action: { kind: 'event', id: 'e1' } }),
    ).toEqual({ pathname: '/events/form', params: { id: 'e1' } });
  });
});
