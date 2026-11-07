import { fireEvent, render, screen } from '@testing-library/react-native';

import { i18n } from '../i18n';
import { loadStateOf, StateView } from './StateView';

describe('états de chargement et d’erreur des listes', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
  });

  it('une lecture sans données est « en cours », ou « en échec » si elle a échoué', () => {
    expect(loadStateOf({ data: undefined, error: null })).toBe('loading');
    expect(loadStateOf({ data: undefined, error: new Error('x') })).toBe('error');
    expect(loadStateOf({ data: [], error: null })).toBe('ready');
    // Des données déjà là (relecture ratée) : on les garde à l'écran.
    expect(loadStateOf({ data: [1], error: new Error('x') })).toBe('ready');
  });

  it('chargement : des lignes fantômes annoncées au lecteur d’écran', async () => {
    await render(<StateView state="loading" />);
    const loading = screen.getByLabelText('Chargement…');
    expect(loading.props.accessibilityRole).toBe('progressbar');
    expect(loading.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('erreur : message clair et « Réessayer »', async () => {
    const retry = jest.fn();
    await render(<StateView state="error" onRetry={retry} />);
    expect(screen.getByText('Impossible d’afficher cette liste')).toBeTruthy();
    expect(
      screen.getByText('Impossible de charger ces données pour le moment. Réessaie.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Réessayer' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('en anglais', async () => {
    await i18n.changeLanguage('en');
    await render(<StateView state="error" onRetry={() => {}} />);
    expect(screen.getByText('Try again')).toBeTruthy();
  });
});
