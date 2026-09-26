import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, ScrollView, Text } from 'react-native';

import { TabBarVisibility, useTabBarHidden, useTabBarScrollHandlers } from './tabBarVisibility';

function Harness() {
  const hidden = useTabBarHidden();
  const scroll = useTabBarScrollHandlers();
  return (
    <ScrollView testID="list" {...scroll}>
      <Text>{hidden ? 'hidden' : 'shown'}</Text>
    </ScrollView>
  );
}

describe('barre d’onglets au défilement', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove() {} });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('se cache pendant le défilement et revient seulement à l’arrêt', () => {
    jest.useFakeTimers();
    render(
      <TabBarVisibility>
        <Harness />
      </TabBarVisibility>,
    );

    expect(screen.getByText('shown')).toBeTruthy();

    fireEvent.scroll(screen.getByTestId('list'), {
      nativeEvent: { contentOffset: { y: 0 }, contentSize: {}, layoutMeasurement: {} },
    });
    expect(screen.getByText('shown')).toBeTruthy();

    fireEvent.scroll(screen.getByTestId('list'), {
      nativeEvent: { contentOffset: { y: 48 }, contentSize: {}, layoutMeasurement: {} },
    });
    expect(screen.getByText('hidden')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(179);
    });
    expect(screen.getByText('hidden')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText('shown')).toBeTruthy();
  });
});
