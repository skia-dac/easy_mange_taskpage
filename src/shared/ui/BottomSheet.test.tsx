import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { spacing } from '../theme';
import { BottomSheet, sheetContentStyle, sheetMaxHeight } from './BottomSheet';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const withInsets = (ui: ReactNode) => (
  <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>
);

describe('fenêtre du bas', () => {
  it('hauteur maximale : ≈ 85 % de la fenêtre, encoche et barre d’accueil exclues', () => {
    expect(sheetMaxHeight(844, { top: 47, bottom: 34 })).toBe(Math.round((844 - 81) * 0.85));
  });

  it('la marge de la barre d’accueil s’ajoute toujours à celle de l’écran', () => {
    const base = { padding: 20, gap: 8 };
    expect(sheetContentStyle(base, undefined, 34)).toMatchObject({
      padding: 20,
      paddingBottom: 54,
    });
    // Une retouche de la marge du bas (sélecteur de date) ne retire pas la barre d'accueil.
    expect(sheetContentStyle(base, { padding: 16, paddingBottom: 28 }, 34)).toMatchObject({
      padding: 16,
      paddingBottom: 62,
    });
    expect(sheetContentStyle(base, { padding: 16 }, 34).paddingBottom).toBe(50);
    expect(sheetContentStyle(base, { gap: 12 }, 0)).toMatchObject({ gap: 12, paddingBottom: 20 });
  });

  it('le contenu défile, borné en hauteur, avec la barre d’accueil en bas', async () => {
    await render(
      withInsets(
        <BottomSheet visible onClose={() => {}} style={{ padding: 16, paddingBottom: 28 }}>
          <Text>Contenu</Text>
        </BottomSheet>,
      ),
    );
    const scroll = screen.getByTestId('sheet-scroll');
    expect(screen.getByText('Contenu')).toBeTruthy();
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      paddingBottom: 28 + metrics.insets.bottom,
      paddingTop: spacing.xs,
    });
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    const panel = screen.getByTestId('sheet-panel');
    expect(StyleSheet.flatten(panel.props.style)).toMatchObject({
      maxHeight: sheetMaxHeight(Dimensions.get('window').height, metrics.insets),
      flexShrink: 1,
    });
  });

  it('la poignée est décorative : cachée au lecteur d’écran, qui garde l’échappement', async () => {
    const onClose = jest.fn();
    await render(
      withInsets(
        <BottomSheet visible onClose={onClose}>
          <Text>Contenu</Text>
        </BottomSheet>,
      ),
    );
    const handle = screen.getByTestId('sheet-handle', { includeHiddenElements: true });
    expect(handle.props.accessible).toBe(false);
    expect(handle.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(handle.props.accessibilityElementsHidden).toBe(true);
    await fireEvent(screen.getByTestId('sheet-panel'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
