import { render, screen } from '@testing-library/react-native';

import { i18n } from '@/shared/i18n';

import TodayScreen from '../(tabs)/index';

describe('écran Aujourd’hui', () => {
  it('affiche l’état vide en français', async () => {
    await i18n.changeLanguage('fr');
    await render(<TodayScreen />);
    expect(screen.getByText('Aucun cours prévu aujourd’hui.')).toBeTruthy();
    expect(screen.getByText('Bonjour')).toBeTruthy();
  });

  it('affiche l’état vide en anglais', async () => {
    await i18n.changeLanguage('en');
    await render(<TodayScreen />);
    expect(screen.getByText('No classes today.')).toBeTruthy();
  });
});
