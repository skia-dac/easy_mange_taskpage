import { normalizeTodayLayout, TODAY_LAYOUT_VERSION, todaySectionIds } from './preferences';

describe('mise en page d’Aujourd’hui', () => {
  it('par défaut : tuiles, fil de la journée, habitudes, à faire ; le reste masqué', () => {
    const l = normalizeTodayLayout(null);
    expect(l.order.slice(0, 4)).toEqual(['glance', 'day', 'habits', 'todo']);
    expect(l.hidden).toEqual(['next', 'money', 'courses', 'revision', 'events', 'exams']);
    expect(l.order).toHaveLength(todaySectionIds.length);
  });

  it('une ancienne mise en page (sans version) passe au nouveau modèle une fois', () => {
    const l = normalizeTodayLayout({ order: ['exams', 'todo'], hidden: ['habits'] });
    expect(l).toEqual(normalizeTodayLayout(null));
  });

  it('garde les choix faits sur le nouveau modèle', () => {
    const l = normalizeTodayLayout({
      v: TODAY_LAYOUT_VERSION,
      order: ['todo', 'glance'],
      hidden: ['day'],
    });
    expect(l.order.slice(0, 3)).toEqual(['todo', 'glance', 'day']);
    expect(l.hidden).toEqual(['day']);
  });
});
