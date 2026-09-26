import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, ScrollView, Text } from 'react-native';

import { PlusButton } from './ui/PlusButton';
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
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove() {} } as unknown as ReturnType<
        typeof AccessibilityInfo.addEventListener
      >);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('se cache pendant le défilement et revient seulement à l’arrêt', async () => {
    jest.useFakeTimers();
    await render(
      <TabBarVisibility>
        <Harness />
      </TabBarVisibility>,
    );

    expect(screen.getByText('shown')).toBeTruthy();

    await fireEvent.scroll(screen.getByTestId('list'), {
      nativeEvent: { contentOffset: { y: 48 } },
    });
    expect(screen.getByText('shown')).toBeTruthy();

    await fireEvent(screen.getByTestId('list'), 'scrollBeginDrag');
    expect(screen.getByText('hidden')).toBeTruthy();

    await fireEvent(screen.getByTestId('list'), 'scrollEndDrag');

    await act(async () => {
      jest.advanceTimersByTime(179);
    });
    expect(screen.getByText('hidden')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByText('shown')).toBeTruthy();
  });

  it('fait suivre le bouton + : caché pendant le défilement, visible menu ouvert', async () => {
    function Page({ open = false }: { open?: boolean }) {
      const scroll = useTabBarScrollHandlers();
      return (
        <ScrollView testID="list" {...scroll}>
          <PlusButton onPress={() => {}} accessibilityLabel="Ajouter" open={open} />
        </ScrollView>
      );
    }

    const view = await render(
      <TabBarVisibility>
        <Page />
      </TabBarVisibility>,
    );

    expect(shellOf(screen.getByLabelText('Ajouter')).props.accessibilityElementsHidden).toBe(false);

    await fireEvent.scroll(screen.getByTestId('list'), {
      nativeEvent: { contentOffset: { y: 80 } },
    });
    expect(shellOf(screen.getByLabelText('Ajouter')).props.accessibilityElementsHidden).toBe(false);

    await fireEvent(screen.getByTestId('list'), 'scrollBeginDrag');
    expect(
      shellOf(screen.getByLabelText('Ajouter', { includeHiddenElements: true })).props
        .accessibilityElementsHidden,
    ).toBe(true);

    await view.rerender(
      <TabBarVisibility>
        <Page open />
      </TabBarVisibility>,
    );
    expect(shellOf(screen.getByLabelText('Ajouter')).props.accessibilityElementsHidden).toBe(false);
  });
});

type Node = {
  props: { accessibilityElementsHidden?: boolean };
  parent: Node | null;
};

function shellOf(node: Node) {
  let current: Node | null = node;
  while (current && current.props.accessibilityElementsHidden === undefined) {
    current = current.parent;
  }
  if (!current) throw new Error('enveloppe du bouton introuvable');
  return current;
}
