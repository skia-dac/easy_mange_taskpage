import { render, screen } from '@testing-library/react-native';
import { BottomTabBarHeightContext } from 'expo-router/build/react-navigation/bottom-tabs';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { spacing } from '../theme';
import { PlusButton } from './PlusButton';

const metrics = (bottom: number) => ({
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom },
});

/** Le conteneur positionné du bouton (celui qui porte `bottom`). */
function bottomOf(label: string) {
  let node = screen.getByLabelText(label).parent;
  while (node) {
    const style = StyleSheet.flatten(node.props.style) as { position?: string; bottom?: number };
    if (style?.position === 'absolute') return style.bottom;
    node = node.parent;
  }
  return undefined;
}

async function show(ui: ReactNode, bottom = 34) {
  await render(<SafeAreaProvider initialMetrics={metrics(bottom)}>{ui}</SafeAreaProvider>);
}

describe('placement du bouton +', () => {
  it('sur un écran de pile, reste au-dessus de la barre d’accueil de l’iPhone', async () => {
    await show(<PlusButton accessibilityLabel="Ajouter" onPress={() => {}} />);
    expect(bottomOf('Ajouter')).toBe(spacing.xl + 34);
  });

  it('dans les onglets, garde sa place au-dessus de la barre d’onglets', async () => {
    await show(
      <BottomTabBarHeightContext.Provider value={80}>
        <PlusButton accessibilityLabel="Ajouter" onPress={() => {}} />
      </BottomTabBarHeightContext.Provider>,
    );
    expect(bottomOf('Ajouter')).toBe(spacing.xl + 80);
  });

  it('un espace demandé l’emporte', async () => {
    await show(<PlusButton accessibilityLabel="Ajouter" onPress={() => {}} bottomInset={12} />);
    expect(bottomOf('Ajouter')).toBe(spacing.xl + 12);
  });
});
