import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { i18n } from '@/shared/i18n';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import type { ActiveSpaces } from '@/shared/spaces';

import { QuickAddMenu } from './QuickAddMenu';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

async function show(active: ActiveSpaces, props: Parameters<typeof QuickAddMenu>[0] = {}) {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <SpacesContext.Provider value={spacesValue(active)}>
        <QuickAddMenu {...props} />
      </SpacesContext.Provider>
    </SafeAreaProvider>,
  );
}

describe('le + qui ouvre un menu (Aujourd’hui, Calendrier)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    jest.mocked(router.push).mockClear();
  });

  it('s’ouvre en menu modal, avec un libellé et un rôle pour chaque choix', async () => {
    await show(['study', 'personal']);
    const plus = screen.getByLabelText('Ajouter');
    expect(plus.props.accessibilityState).toMatchObject({ expanded: false });
    await fireEvent.press(plus);
    expect(screen.getByTestId('quick-add-menu').props.accessibilityViewIsModal).toBe(true);
    expect(screen.getByLabelText('Fermer', { exact: true })).toBeTruthy();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.props.accessibilityLabel)).toEqual([
      'Dépense',
      'Entrée d’argent',
      'Tâche',
      'Note',
      'Rendez-vous',
      'Minuteur de révision',
      'Autre (examen, cours…)',
    ]);
  });

  it('sans Études : pas de « Autre (examen…) »', async () => {
    await show(['work']);
    await fireEvent.press(screen.getByLabelText('Ajouter'));
    expect(screen.queryByText('Autre (examen, cours…)')).toBeNull();
    expect(screen.queryByText('Dépense')).toBeNull();
    expect(screen.getByText('Rendez-vous')).toBeTruthy();
  });

  it('se ferme par le geste « échap » du lecteur d’écran', async () => {
    await show(['study']);
    await fireEvent.press(screen.getByLabelText('Ajouter'));
    await fireEvent(screen.getByTestId('quick-add-menu'), 'accessibilityEscape');
    expect(screen.queryByTestId('quick-add-menu')).toBeNull();
    expect(screen.getByLabelText('Ajouter')).toBeTruthy();
  });

  it('dans le calendrier, les ajouts partent du jour choisi', async () => {
    await show(['work'], { date: '2026-10-02' });
    await fireEvent.press(screen.getByLabelText('Ajouter'));
    await fireEvent.press(screen.getByText('Tâche'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/work/form',
      params: { date: '2026-10-02' },
    });
    expect(screen.queryByTestId('quick-add-menu')).toBeNull();
  });

  it('sur Aujourd’hui (sans jour choisi), la tâche est pour aujourd’hui : elle y apparaît', async () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 23, 10, 18) });
    try {
      await show(['work']);
      await fireEvent.press(screen.getByLabelText('Ajouter'));
      await fireEvent.press(screen.getByText('Tâche'));
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/work/form',
        params: { date: '2026-09-23' },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
