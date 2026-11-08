import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { i18n } from '../i18n';
import { lightColors } from '../theme';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { ChoiceSheet } from './ChoiceSheet';
import { ListRow } from './ListRow';
import { PlusButton } from './PlusButton';
import { SwipeRow } from './SwipeRow';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const withInsets = (ui: ReactNode) => (
  <SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>
);

/** Vrai si `node` est dans `ancestor` (ou est `ancestor`). */
function isInside(node: { parent: unknown } | null, ancestor: unknown) {
  let n = node as { parent: unknown } | null;
  while (n) {
    if (n === ancestor) return true;
    n = n.parent as { parent: unknown } | null;
  }
  return false;
}

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('ligne avec case à cocher (VoiceOver, TalkBack)', () => {
  it('la case et la ligne sont deux éléments atteignables séparément', async () => {
    const onToggle = jest.fn();
    const onPress = jest.fn();
    await render(
      <ListRow
        title="Exposé d’histoire"
        subtitle="Demain"
        control={<Checkbox checked={false} onToggle={onToggle} accessibilityLabel="Exposé" />}
        onPress={onPress}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'Exposé' });
    const row = screen.getByRole('button', { name: 'Exposé d’histoire, Demain' });
    // Un bouton qui contiendrait la case la rendrait inatteignable avec VoiceOver.
    expect(isInside(box, row)).toBe(false);
    expect(isInside(row, box)).toBe(false);
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(box);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('la case reste à gauche de la ligne', async () => {
    await render(
      <ListRow
        title="Loyer"
        control={<Checkbox checked onToggle={() => {}} accessibilityLabel="Marquer Loyer" />}
        onPress={() => {}}
      />,
    );
    const box = screen.getByRole('checkbox');
    const row = screen.getByRole('button', { name: 'Loyer' });
    // Même parent : la case vient en premier.
    let shared = box.parent;
    while (shared && !isInside(row, shared)) shared = shared.parent;
    const order = (shared?.children ?? []).filter((c) => typeof c !== 'string');
    const boxIndex = order.findIndex((c) => isInside(box, c));
    const rowIndex = order.findIndex((c) => isInside(row, c));
    expect(boxIndex).toBeGreaterThanOrEqual(0);
    expect(boxIndex).toBeLessThan(rowIndex);
  });
});

describe('ligne qu’on fait glisser', () => {
  const actions = () =>
    ({
      right: {
        label: 'Marquer comme terminé',
        icon: 'check',
        color: 'success',
        onAction: jest.fn(),
      },
      left: { label: 'Reporter', icon: 'clock', color: 'warning', onAction: jest.fn() },
    }) as const;

  it('offre ses actions au lecteur d’écran, sur le bouton de la ligne', async () => {
    const { right, left } = actions();
    await render(
      <GestureHandlerRootView>
        <SwipeRow right={right} left={left}>
          {(a11y) => <ListRow {...a11y} title="Réviser" onPress={() => {}} />}
        </SwipeRow>
      </GestureHandlerRootView>,
    );
    const row = screen.getByRole('button', { name: 'Réviser' });
    expect((row.props.accessibilityActions as { label: string }[]).map((a) => a.label)).toEqual([
      'Marquer comme terminé',
      'Reporter',
    ]);
    const [primary, secondary] = row.props.accessibilityActions as { name: string }[];
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: primary?.name } });
    expect(right.onAction).toHaveBeenCalledTimes(1);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: secondary?.name } });
    expect(left.onAction).toHaveBeenCalledTimes(1);
  });

  it('geste coupé (tâche terminée) : plus d’action proposée', async () => {
    const { right, left } = actions();
    await render(
      <GestureHandlerRootView>
        <SwipeRow right={right} left={left} enabled={false}>
          {(a11y) => <ListRow {...a11y} title="Réviser" onPress={() => {}} />}
        </SwipeRow>
      </GestureHandlerRootView>,
    );
    expect(screen.getByRole('button', { name: 'Réviser' }).props.accessibilityActions).toEqual([]);
  });
});

describe('fenêtre de choix', () => {
  it('le voile ne contient pas les choix et n’est pas lu ; le panneau est modal', async () => {
    const onClose = jest.fn();
    const pick = jest.fn();
    await render(
      withInsets(
        <ChoiceSheet
          visible
          title="Reporter à quand ?"
          options={[
            { label: 'Demain', onPress: pick },
            { label: 'Lundi prochain', onPress: () => {} },
          ]}
          onClose={onClose}
        />,
      ),
    );
    const backdrop = screen.getByTestId('sheet-backdrop', { includeHiddenElements: true });
    const panel = screen.getByTestId('sheet-panel');
    const option = screen.getByRole('button', { name: 'Demain' });
    expect(isInside(option, backdrop)).toBe(false);
    expect(within(backdrop).queryByText('Demain', { includeHiddenElements: true })).toBeNull();
    expect(isInside(option, panel)).toBe(true);
    expect(backdrop.props.accessible).toBe(false);
    expect(backdrop.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(panel.props.accessibilityViewIsModal).toBe(true);

    await fireEvent.press(option);
    expect(pick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Le geste d'échappement de VoiceOver ferme la fenêtre.
    await fireEvent(panel, 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(2);
    // Toucher le voile ferme aussi.
    await fireEvent.press(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});

describe('bouton', () => {
  it('désactivé : annoncé comme tel, grisé, et sans effet', async () => {
    const onPress = jest.fn();
    await render(<Button label="Enregistrer" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      backgroundColor: lightColors.disabled,
    });
    expect(StyleSheet.flatten(screen.getByText('Enregistrer').props.style)).toMatchObject({
      color: lightColors.muted,
    });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('actif : annoncé actif', async () => {
    await render(<Button label="Enregistrer" onPress={() => {}} />);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: false });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({
      backgroundColor: lightColors.primary,
    });
  });
});

describe('bouton +', () => {
  it('qui crée directement : pas d’état « replié »', async () => {
    await render(withInsets(<PlusButton accessibilityLabel="Nouvelle note" onPress={() => {}} />));
    expect(
      screen.getByRole('button', { name: 'Nouvelle note' }).props.accessibilityState?.expanded,
    ).toBeUndefined();
  });

  it('qui ouvre un menu : replié puis déployé', async () => {
    const { rerender } = await render(
      withInsets(<PlusButton accessibilityLabel="Ajouter" menuOpen={false} onPress={() => {}} />),
    );
    expect(screen.getByRole('button', { name: 'Ajouter' }).props.accessibilityState).toMatchObject({
      expanded: false,
    });
    await rerender(withInsets(<PlusButton accessibilityLabel="Ajouter" open onPress={() => {}} />));
    expect(screen.getByRole('button', { name: 'Ajouter' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });
});

describe('ChoiceSheet : option choisie et noms en double', () => {
  it('annonce l’option choisie et accepte deux options de même nom', async () => {
    await render(
      withInsets(
        <ChoiceSheet
          visible
          title="Matière"
          options={[
            { label: 'Toutes', onPress: () => {} },
            { label: 'Maths', selected: true, onPress: () => {} },
            { label: 'Maths', onPress: () => {} },
          ]}
          onClose={() => {}}
        />,
      ),
    );
    expect(screen.getAllByRole('button', { name: /Maths/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /Maths/, selected: true })).toHaveLength(1);
    expect(screen.queryAllByRole('button', { name: /Toutes/, selected: true })).toHaveLength(0);
  });
});
