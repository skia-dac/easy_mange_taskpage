import { fireEvent, render, screen } from '@testing-library/react-native';

import { DayOfMonthPicker } from './DayOfMonthPicker';

describe('DayOfMonthPicker', () => {
  it('montre les 31 jours d’un coup, le jour choisi coché, et change en un toucher', async () => {
    const onChange = jest.fn();
    await render(
      <DayOfMonthPicker
        value={25}
        onChange={onChange}
        accessibilityLabel="Ton mois commence le"
        dayLabel={(d) => `Le ${d}`}
      />,
    );
    expect(screen.getAllByRole('radio')).toHaveLength(31);
    expect(screen.getByRole('radio', { name: 'Le 25' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByRole('radio', { name: 'Le 1' }));
    expect(onChange).toHaveBeenCalledWith(1);
    await fireEvent.press(screen.getByRole('radio', { name: 'Le 25' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
