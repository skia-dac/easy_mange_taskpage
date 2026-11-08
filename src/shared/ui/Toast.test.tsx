import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Alert, Keyboard, StyleSheet, type KeyboardEvent } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
import { i18n } from '../i18n';
import { reportTabBarHeight } from '../tabBarVisibility';
import { showError } from './dialogs';
import { PlusButton } from './PlusButton';
import {
  canShowToast,
  SCREEN_READER_SHOW_MS,
  showErrorToast,
  showToast,
  showUndoToast,
  splitMessage,
  ToastHost,
} from './Toast';
import {
  fabLiftFor,
  getToastHeight,
  TOAST_BOTTOM_GAP,
  TOAST_SIDE_MARGIN,
  useCoversToast,
} from './toastLayout';

let mockSegments = ['(tabs)'];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));

const Host = ({ children, bottom = 0 }: { children?: ReactNode; bottom?: number }) => (
  <GestureHandlerRootView>
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom },
      }}
    >
      {children}
      <ToastHost />
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

/** Style du conteneur positionné du message (celui qui porte `bottom`). */
function toastPlacement(): { bottom?: number; left?: number; right?: number } {
  let node = screen.getByTestId('toast').parent;
  while (node) {
    const style = StyleSheet.flatten(node.props.style) as
      { bottom?: number; left?: number; right?: number } | undefined;
    if (style?.bottom !== undefined) return style;
    node = node.parent;
  }
  return {};
}
const toastBottom = () => toastPlacement().bottom;

/** Le message a été mesuré à l'écran (le test n'a pas de mise en page). */
const measure = (height: number) =>
  act(async () =>
    fireEvent(screen.getByTestId('toast-frame'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 358, height } },
    }),
  );

beforeEach(() => {
  mockSegments = ['(tabs)'];
  reportTabBarHeight(0);
});

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('affiche le message puis le retire tout seul', async () => {
    await render(<Host />);
    await act(async () => showToast('Terminé : Maths'));
    expect(screen.getByText('Terminé : Maths')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(4000));
    expect(screen.queryByText('Terminé : Maths')).toBeNull();
  });

  it('« Annuler » lance l’action inverse, ferme le message et donne un retour tactile', async () => {
    await render(<Host />);
    const undo = jest.fn();
    jest.mocked(Haptics.selectionAsync).mockClear();
    await act(async () => showUndoToast('Reporté au 26/09', undo));
    await act(async () => fireEvent.press(screen.getByText(i18n.t('toast.undo'))));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Reporté au 26/09')).toBeNull();
  });

  it('sans hôte monté, showToast ne plante pas', () => {
    expect(() => showToast('rien')).not.toThrow();
    expect(canShowToast()).toBe(false);
  });

  it('se pose juste au-dessus de la barre d’onglets, avec 16 pt de marge sur les côtés', async () => {
    await render(<Host />);
    await act(async () => showUndoToast('Terminé : Maths', () => {}));
    // Barre pas encore mesurée : sa hauteur par défaut (56), plus le petit écart. Plus de place
    // réservée au bouton + : c'est lui qui remonte.
    expect(toastBottom()).toBe(56 + TOAST_BOTTOM_GAP);
    expect(toastPlacement().left).toBe(TOAST_SIDE_MARGIN);
    expect(toastPlacement().right).toBe(TOAST_SIDE_MARGIN);
    expect(TOAST_SIDE_MARGIN).toBe(16);
    await act(async () => reportTabBarHeight(83));
    expect(toastBottom()).toBe(83 + TOAST_BOTTOM_GAP);
  });

  it('hors des onglets : juste au-dessus de la barre d’accueil', async () => {
    mockSegments = ['settings'];
    await render(<Host bottom={34} />);
    await act(async () => showToast('Enregistré'));
    expect(toastBottom()).toBe(34 + TOAST_BOTTOM_GAP);
  });

  it('titre court et détail sur une ligne chacun, annoncés ensemble', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    // Texte à sa taille normale (pas de grossissement du téléphone).
    const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');
    dimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    await render(<Host />);
    await act(async () =>
      showUndoToast({ title: 'Payé', detail: 'Tontine des amis de la fac' }, () => {}),
    );
    expect(screen.getByText('Payé').props.numberOfLines).toBe(1);
    expect(screen.getByText('Tontine des amis de la fac').props.numberOfLines).toBe(1);
    expect(screen.queryByText(/Tontine des amis de la fac : payé/)).toBeNull();
    expect(announce).toHaveBeenCalledWith(
      `Payé Tontine des amis de la fac ${i18n.t('toast.undo')}`,
    );
    announce.mockRestore();
    dimensions.mockRestore();
  });

  it('une icône selon le ton : réussi pour « Annuler », info par défaut, sinon celui demandé', async () => {
    await render(<Host />);
    await act(async () => showUndoToast({ title: 'Payé', detail: 'Loyer' }, () => {}));
    expect(screen.getByTestId('toast-icon-success', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => showToast('Rien à copier'));
    expect(screen.getByTestId('toast-icon-info', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => showToast('Session expirée', { tone: 'warning' }));
    expect(screen.getByTestId('toast-icon-warning', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => showToast('Impossible d’ouvrir ce fichier', { tone: 'error' }));
    expect(screen.getByTestId('toast-icon-error', { includeHiddenElements: true })).toBeTruthy();
    // L'icône est un décor : le lecteur d'écran lit le texte.
    expect(screen.queryByTestId('toast-icon-error')).toBeNull();
  });

  it('un nouveau message remplace le précédent', async () => {
    await render(<Host />);
    await act(async () => showToast('Premier'));
    await act(async () => showToast('Second'));
    expect(screen.queryByText('Premier')).toBeNull();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });

  it('l’ancienne forme `showToast(texte, action)` marche toujours', async () => {
    await render(<Host />);
    const onPress = jest.fn();
    await act(async () => showToast('Un conflit', { label: 'Voir', onPress }));
    await act(async () => fireEvent.press(screen.getByText('Voir')));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Toast et bouton +', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const fabShift = () => {
    const transform = (getAnimatedStyle(screen.getByTestId('plus-button')).transform ??
      []) as unknown as Record<string, number>[];
    return transform.find((t) => 'translateY' in t)?.translateY ?? 0;
  };

  it('le message annonce sa hauteur, le bouton + remonte au-dessus, puis redescend', async () => {
    await render(
      <Host>
        <PlusButton accessibilityLabel="Ajouter" onPress={() => {}} />
      </Host>,
    );
    expect(getToastHeight()).toBe(0);
    await act(async () => showToast({ title: 'Payé', detail: 'Loyer' }, { tone: 'success' }));
    await measure(60);
    expect(getToastHeight()).toBe(60);
    await act(async () => jest.advanceTimersByTime(400));
    // Plus haut que le message : écart sous le message + sa hauteur + écart au-dessus.
    expect(fabShift()).toBeCloseTo(-fabLiftFor(60));
    expect(fabLiftFor(60)).toBeGreaterThan(60 - 20);

    await act(async () => jest.advanceTimersByTime(4000));
    expect(screen.queryByText('Payé')).toBeNull();
    expect(getToastHeight()).toBe(0);
    await act(async () => jest.advanceTimersByTime(400));
    expect(fabShift()).toBeCloseTo(0);
  });

  it('sans message, le bouton ne bouge pas', () => {
    expect(fabLiftFor(0)).toBe(0);
  });
});

describe('Toast : gestes et minuterie', () => {
  // Les gestes ne s'enregistrent pour `fireGestureHandler` que si NODE_ENV vaut « test ».
  const env = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });
  afterAll(() => {
    process.env.NODE_ENV = env;
  });
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const swipe = (translationX: number, translationY: number) =>
    act(async () => {
      fireGestureHandler(getByGestureTestId('toast-swipe'), [
        { state: State.BEGAN, translationX: 0, translationY: 0, velocityX: 0, velocityY: 0 },
        {
          state: State.ACTIVE,
          translationX: translationX / 2,
          translationY: translationY / 2,
          velocityX: 0,
          velocityY: 0,
        },
        { state: State.ACTIVE, translationX, translationY, velocityX: 0, velocityY: 0 },
        { state: State.END, translationX, translationY, velocityX: 0, velocityY: 0 },
      ]);
      // Fin de l'animation de sortie.
      jest.advanceTimersByTime(500);
    });

  it('glisser sur le côté ferme le message', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await swipe(200, 0);
    expect(screen.queryByText('Enregistré')).toBeNull();
  });

  it('glisser vers le bas ferme le message', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await swipe(0, 90);
    expect(screen.queryByText('Enregistré')).toBeNull();
  });

  it('un petit glissement ne ferme pas le message', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await swipe(10, 8);
    expect(screen.getByText('Enregistré')).toBeTruthy();
  });

  it('doigt posé : le temps s’arrête, puis il reste encore un moment', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await act(async () => jest.advanceTimersByTime(3000));
    // Un appui (sans glisser) : pause, puis la minuterie repart avec au moins 1,5 s.
    await swipe(0, 0);
    await act(async () => jest.advanceTimersByTime(600));
    expect(screen.getByText('Enregistré')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(screen.queryByText('Enregistré')).toBeNull();
  });
});

describe('Toast : clavier et grand texte', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clavier ouvert : le message se pose au-dessus, puis redescend', async () => {
    const handlers = new Map<string, (e: KeyboardEvent) => void>();
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, handler) => {
      handlers.set(name, handler as (e: KeyboardEvent) => void);
      return { remove: () => {} } as ReturnType<typeof Keyboard.addListener>;
    });
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    const resting = toastBottom()!;

    const show = handlers.get('keyboardWillShow') ?? handlers.get('keyboardDidShow');
    const hide = handlers.get('keyboardWillHide') ?? handlers.get('keyboardDidHide');
    await act(async () =>
      show?.({
        endCoordinates: { height: 336, screenX: 0, screenY: 508, width: 390 },
      } as KeyboardEvent),
    );
    expect(toastBottom()).toBeGreaterThan(336);
    // Au-dessus du clavier, le bouton + (caché dessous) ne remonte pas.
    await measure(60);
    expect(getToastHeight()).toBe(0);
    await act(async () => hide?.({} as KeyboardEvent));
    expect(toastBottom()).toBe(resting);
  });

  it('texte très grand : le message n’est plus coupé', async () => {
    const dimensions = jest.spyOn(require('react-native'), 'useWindowDimensions');
    dimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    await render(<Host />);
    await act(async () => showToast('Texte normal'));
    expect(screen.getByText('Texte normal').props.numberOfLines).toBe(2);
    await screen.unmount();

    dimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 2 });
    await render(<Host />);
    await act(async () => showToast('Un message assez long pour passer sur plusieurs lignes'));
    expect(
      screen.getByText('Un message assez long pour passer sur plusieurs lignes').props
        .numberOfLines,
    ).toBeUndefined();
    await act(async () => showToast({ title: 'Payé', detail: 'Tontine des amis de la fac' }));
    expect(screen.getByText('Payé').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('Tontine des amis de la fac').props.numberOfLines).toBeUndefined();
  });
});

describe('Toast avec un lecteur d’écran', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('un message avec « Annuler » ne part pas tout seul, et « Fermer » le retire', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await render(<Host />);
    await act(async () => showUndoToast('Terminé : Maths', () => {}));
    expect(announce).toHaveBeenCalledWith(`Terminé : Maths ${i18n.t('toast.undo')}`);
    await act(async () => jest.advanceTimersByTime(60000));
    expect(screen.getByText('Terminé : Maths')).toBeTruthy();
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: i18n.t('common.close') })),
    );
    expect(screen.queryByText('Terminé : Maths')).toBeNull();
  });

  it('titre et détail : même règle, et « Annuler » reste un bouton', async () => {
    await render(<Host />);
    await act(async () => showUndoToast({ title: 'Payé', detail: 'Loyer' }, () => {}));
    await act(async () => jest.advanceTimersByTime(60000));
    expect(screen.getByText('Payé')).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('toast.undo') })).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('common.close') })).toBeTruthy();
    expect(screen.getByTestId('toast').props.accessibilityRole).toBe('alert');
  });

  it('un message seul reste au moins 20 secondes', async () => {
    await render(<Host />);
    await act(async () => showToast('Enregistré'));
    await act(async () => jest.advanceTimersByTime(SCREEN_READER_SHOW_MS - 1000));
    expect(screen.getByText('Enregistré')).toBeTruthy();
    expect(SCREEN_READER_SHOW_MS).toBeGreaterThanOrEqual(20000);
    await act(async () => jest.advanceTimersByTime(2000));
    expect(screen.queryByText('Enregistré')).toBeNull();
  });
});

describe('erreurs non bloquantes', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('une phrase double devient un titre et un détail', () => {
    expect(splitMessage('Impossible d’enregistrer. Tes données n’ont pas été perdues.')).toEqual({
      title: 'Impossible d’enregistrer',
      detail: 'Tes données n’ont pas été perdues.',
    });
    expect(splitMessage('Ce champ est obligatoire.')).toEqual({
      title: 'Ce champ est obligatoire',
    });
  });

  it('showError : un message « erreur » en bas de l’écran, sans alerte', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<Host />);
    await act(async () => showError('errors.saveFailed'));
    expect(alert).not.toHaveBeenCalled();
    expect(screen.getByTestId('toast-icon-error', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(splitMessage(i18n.t('errors.saveFailed')).title)).toBeTruthy();
    // Une erreur se lit en entier : elle reste plus longtemps qu'un simple message.
    await act(async () => jest.advanceTimersByTime(4000));
    expect(screen.getByText(splitMessage(i18n.t('errors.saveFailed')).title)).toBeTruthy();
  });

  it('une fenêtre ouverte cacherait le message : alerte native à la place', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    function Sheet() {
      useCoversToast(true);
      return null;
    }
    await render(
      <Host>
        <Sheet />
      </Host>,
    );
    await act(async () => showErrorToast('errors.saveFailed'));
    expect(alert).toHaveBeenCalledWith(i18n.t('errors.title'), i18n.t('errors.saveFailed'));
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('écran « Ajouter » (fenêtre native) : alerte native', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockSegments = ['add'];
    await render(<Host />);
    await act(async () => showError('errors.generic'));
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('sans hôte (tests d’écran) : alerte native', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    showError('errors.generic');
    expect(alert).toHaveBeenCalledWith(i18n.t('errors.title'), i18n.t('errors.generic'));
  });
});

describe('appels de showToast / showUndoToast dans l’app', () => {
  const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !/\.test\.tsx?$/.test(f) && !f.endsWith('shared/ui/Toast.tsx'));

  /** Chaque appel, avec ses arguments (parenthèses équilibrées). */
  const calls = files.flatMap((f) => {
    const src = readFileSync(f, 'utf8');
    return [...src.matchAll(/\bshow(?:Undo)?Toast\(/g)].map((m) => {
      let i = m.index + m[0].length;
      let depth = 1;
      while (depth > 0 && i < src.length) {
        if (src[i] === '(') depth++;
        else if (src[i] === ')') depth--;
        i++;
      }
      return { file: f, args: src.slice(m.index + m[0].length, i - 1) };
    });
  });

  const lookup = (dict: unknown, key: string): string[] => {
    const get = (k: string) =>
      k
        .split('.')
        .reduce<unknown>(
          (o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined),
          dict,
        );
    return [key, `${key}_one`, `${key}_other`]
      .map(get)
      .filter((v): v is string => typeof v === 'string');
  };

  it('il y en a partout dans l’app (le test les trouve bien)', () => {
    expect(calls.length).toBeGreaterThan(15);
  });

  it('aucun message n’est fabriqué en collant un nom et « : » (« {{name}} : payé »)', () => {
    const glued = /\{\{\w+\}\}\s*:|:\s*\{\{\w+\}\}/;
    const bad: string[] = [];
    for (const { file, args } of calls) {
      // Gabarit JS : `${nom} : payé`.
      if (/`[^`]*(\$\{[^}]*\}\s*:|:\s*\$\{)/.test(args)) bad.push(`${file}: ${args}`);
      for (const m of args.matchAll(/\bt\(\s*'([\w.]+)'/g)) {
        for (const value of [...lookup(fr, m[1]!), ...lookup(en, m[1]!)]) {
          if (glued.test(value)) bad.push(`${file}: ${m[1]} = « ${value} »`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('les messages sur un élément nommé passent un titre et le nom en détail', () => {
    const named = [
      ['src/components/money/DueList.tsx', 'detail: d.recurring.name'],
      ['src/components/HabitRow.tsx', 'detail: habit.name'],
      ['src/hooks/useWorkActions.ts', 'detail: item.title'],
    ] as const;
    for (const [file, detail] of named) {
      const own = calls.filter((c) => c.file === file);
      expect(own.length).toBeGreaterThan(0);
      for (const c of own) {
        expect(c.args).toMatch(/\{\s*title:/);
        expect(c.args).toContain(detail);
      }
    }
  });

  it('les titres sont courts : ils tiennent sur une ligne', () => {
    const long: string[] = [];
    for (const { file, args } of calls) {
      const title = /title:\s*(?:tRef\.current|i18n\.t|t)\(\s*'([\w.]+)'/.exec(args);
      if (!title) continue;
      for (const value of [...lookup(fr, title[1]!), ...lookup(en, title[1]!)]) {
        if (value.length > 40) long.push(`${file}: ${title[1]} = « ${value} »`);
      }
    }
    expect(long).toEqual([]);
  });
});
