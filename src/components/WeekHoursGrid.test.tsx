import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import type { Exam, Subject } from '@/modules/academic';
import type { PersonalEvent } from '@/modules/productivity';
import type { CalendarItem } from '@/projections';
import { i18n } from '@/shared/i18n';

import {
  accessibleMove,
  BLOCK_ACTIONS,
  blockHitSlop,
  blockKeys,
  DROP_FALLBACK_MS,
  WeekHoursGrid,
} from './WeekHoursGrid';

const MONDAY = '2026-09-21';
const event: CalendarItem = {
  kind: 'event',
  sortTime: '10:00',
  event: { id: 'e', title: 'Dentiste', startTime: '10:00', endTime: '11:00' } as PersonalEvent,
};
const exam: CalendarItem = {
  kind: 'exam',
  sortTime: '14:00',
  exam: { id: 'x', subjectId: 's', date: MONDAY, time: '14:00' } as Exam,
};

async function renderGrid(items: CalendarItem[]) {
  const onOpen = jest.fn();
  const onMove = jest.fn();
  await render(
    <GestureHandlerRootView>
      <WeekHoursGrid
        weekStart={MONDAY}
        today={MONDAY}
        days={new Map([[MONDAY, items]])}
        subjects={new Map<string, Subject>()}
        onOpen={onOpen}
        onMove={onMove}
      />
    </GestureHandlerRootView>,
  );
  // Les blocs ne sont posés qu'une fois la largeur connue.
  await fireEvent(screen.getByTestId('hours-grid'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 600, x: 0, y: 0 } },
  });
  return { onOpen, onMove };
}

const actionNames = (node: { props: { accessibilityActions?: { name: string }[] } }) =>
  (node.props.accessibilityActions ?? []).map((a) => a.name);

beforeEach(async () => {
  await i18n.changeLanguage('fr');
});

describe('vue heures au lecteur d’écran', () => {
  it('déplace d’un quart d’heure ou d’un jour avec le même calcul que le glisser', () => {
    const block = { start: 10 * 60, end: 11 * 60 };
    expect(accessibleMove(block, MONDAY, BLOCK_ACTIONS.earlier)).toEqual({
      date: MONDAY,
      startTime: '09:45',
      endTime: '10:45',
    });
    expect(accessibleMove(block, MONDAY, BLOCK_ACTIONS.later)).toEqual({
      date: MONDAY,
      startTime: '10:15',
      endTime: '11:15',
    });
    expect(accessibleMove(block, MONDAY, BLOCK_ACTIONS.nextDay)?.date).toBe('2026-09-22');
    expect(accessibleMove(block, MONDAY, BLOCK_ACTIONS.previousDay)?.date).toBe('2026-09-20');
    // Déjà en début de journée : rien à avancer.
    expect(accessibleMove({ start: 0, end: 60 }, MONDAY, BLOCK_ACTIONS.earlier)).toBeNull();
    expect(accessibleMove(block, MONDAY, 'inconnu')).toBeNull();
  });

  it('un bloc annonce jour et heures, s’ouvre et se déplace sans geste', async () => {
    const { onOpen, onMove } = await renderGrid([event]);
    const block = screen.getByRole('button', { name: /^Dentiste, lundi 21, 10:00 – 11:00/ });
    expect(actionNames(block)).toEqual([
      BLOCK_ACTIONS.open,
      BLOCK_ACTIONS.earlier,
      BLOCK_ACTIONS.later,
      BLOCK_ACTIONS.previousDay,
      BLOCK_ACTIONS.nextDay,
    ]);
    expect(block.props.accessibilityActions.map((a: { label: string }) => a.label)).toEqual([
      i18n.t('calendar.open'),
      i18n.t('calendar.moveEarlier'),
      i18n.t('calendar.moveLater'),
      i18n.t('calendar.movePreviousDay'),
      i18n.t('calendar.moveNextDay'),
    ]);

    await fireEvent(block, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onOpen).toHaveBeenCalledWith(event);

    await fireEvent(block, 'accessibilityAction', {
      nativeEvent: { actionName: BLOCK_ACTIONS.later },
    });
    expect(onMove).toHaveBeenCalledWith(event, {
      date: MONDAY,
      startTime: '10:15',
      endTime: '11:15',
    });
  });

  it('un examen (non déplaçable) ne propose que « Ouvrir »', async () => {
    const { onMove } = await renderGrid([exam]);
    const block = screen.getByRole('button', { name: /^Examen, lundi 21/ });
    expect(actionNames(block)).toEqual([BLOCK_ACTIONS.open]);
    await fireEvent(block, 'accessibilityAction', {
      nativeEvent: { actionName: BLOCK_ACTIONS.later },
    });
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('vue heures : toucher, repères et lâcher', () => {
  // Les gestes ne s'enregistrent pour `fireGestureHandler` que si NODE_ENV vaut « test ».
  const env = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    jest.useFakeTimers();
  });
  afterAll(() => {
    process.env.NODE_ENV = env;
    jest.useRealTimers();
  });

  it('un petit bloc garde une zone de toucher de 44 pt sans changer l’échelle', () => {
    expect(blockHitSlop(46, 18, true)).toEqual({ top: 13, bottom: 13, left: 0, right: 0 });
    // À côté d'un autre bloc : rien sur les côtés, pour ne pas lui prendre sa surface.
    expect(blockHitSlop(21, 18, false)).toEqual({ top: 13, bottom: 13, left: 0, right: 0 });
    expect(blockHitSlop(40, 50, true)).toEqual({ top: 0, bottom: 0, left: 2, right: 2 });
  });

  it('clés stables : l’élément, pas son rang ; doublons distingués', () => {
    expect(blockKeys([event, exam])).toEqual(['e-e', 'x-x']);
    expect(blockKeys([exam, event])).toEqual(['x-x', 'e-e']);
    expect(blockKeys([event, event])).toEqual(['e-e', 'e-e#1']);
  });

  it('heures du bord traduites, pastilles « toute la journée » de 44 pt', async () => {
    const allDay: CalendarItem = {
      kind: 'event',
      sortTime: '',
      event: { id: 'j', title: 'Salon', startTime: null, endTime: null } as PersonalEvent,
    };
    await renderGrid([event, allDay]);
    expect(screen.getByText(i18n.t('calendar.hourMark', { hour: 10 }))).toBeTruthy();
    expect(screen.queryByText('10h')).toBeNull();
    const chip = screen.getByRole('button', { name: 'Salon' });
    expect(StyleSheet.flatten(chip.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  const drag = (id: string, translationY: number) =>
    act(async () => {
      fireGestureHandler(getByGestureTestId(id), [
        { state: State.BEGAN, translationX: 0, translationY: 0 },
        { state: State.ACTIVE, translationX: 0, translationY },
        { state: State.END, translationX: 0, translationY },
      ]);
      jest.advanceTimersByTime(600);
    });
  const offsetY = () => {
    const node = screen.getByRole('button', { name: /^Dentiste/ });
    const transform = (getAnimatedStyle(node).transform ?? []) as unknown as Record<
      string,
      number
    >[];
    return transform.find((t) => 'translateY' in t)?.translateY ?? 0;
  };

  it('lâché ailleurs : le bloc reste où on l’a posé en attendant les données', async () => {
    const { onMove } = await renderGrid([event]);
    onMove.mockResolvedValue(true);
    await drag('block-e-e-drag', 52);
    expect(onMove).toHaveBeenCalledWith(event, {
      date: MONDAY,
      startTime: '11:00',
      endTime: '12:00',
    });
    expect(offsetY()).toBeCloseTo(52, 0);
    // Rien reçu : il finit par revenir.
    await act(async () => {
      jest.advanceTimersByTime(DROP_FALLBACK_MS + 600);
    });
    expect(offsetY()).toBeCloseTo(0, 0);
  });

  it('déplacement refusé : le bloc revient tout de suite', async () => {
    const { onMove } = await renderGrid([event]);
    onMove.mockResolvedValue(false);
    await drag('block-e-e-drag', 52);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(offsetY()).toBeCloseTo(0, 0);
  });
});
