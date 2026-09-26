import { Circle, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Habitudes » (petit, moyen, grand) : les habitudes du jour, faites ou non. */
const HabitsWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const family = environment.widgetFamily;
  const limit = family === 'systemSmall' ? 3 : family === 'systemMedium' ? 4 : 8;
  const habits = props.habits.slice(0, limit);
  const done = props.habits.filter((h) => h.done).length;

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.habits)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
          {props.labels.habits.toUpperCase()}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(theme.text)]}>
          {`${done}/${props.habits.length}`}
        </Text>
      </HStack>
      {habits.length === 0 ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.muted)]}>{props.labels.noHabit}</Text>
      ) : null}
      {habits.map((h, i) => (
        <HStack key={`h${i}`} spacing={6}>
          <Circle
            modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(h.done ? theme.success : h.color)]}
          />
          <Text
            modifiers={[
              font({ size: 14 }),
              foregroundStyle(h.done ? theme.muted : theme.text),
              lineLimit(1),
              ...(h.done ? [strikethrough({ isActive: true, pattern: 'solid' })] : []),
            ]}
          >
            {h.name}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(h.done ? theme.success : theme.muted)]}>
            {h.done ? '✓' : h.progress}
          </Text>
        </HStack>
      ))}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('HabitsWidget', HabitsWidget);
