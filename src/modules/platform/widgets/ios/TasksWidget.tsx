import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Tâches » (petit, moyen, grand) : ce qu'il reste à faire aujourd'hui et en retard. */
const TasksWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const family = environment.widgetFamily;
  const limit = family === 'systemSmall' ? 3 : family === 'systemMedium' ? 4 : 8;
  const tasks = props.tasks.slice(0, limit);
  const hidden = props.tasks.length - tasks.length + props.moreTasks;

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.url)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
          {props.labels.tasks.toUpperCase()}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(theme.text)]}>
          {String(props.tasks.length + props.moreTasks)}
        </Text>
      </HStack>
      {tasks.length === 0 ? (
        <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.muted)]}>
          {props.labels.noTask}
        </Text>
      ) : null}
      {tasks.map((t, i) => (
        <HStack key={`t${i}`} spacing={6}>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(t.overdue ? theme.danger : theme.primary)]}>
            {'○'}
          </Text>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.text), lineLimit(1)]}>
            {t.title}
          </Text>
          <Spacer />
          {family !== 'systemSmall' ? (
            <Text modifiers={[font({ size: 12 }), foregroundStyle(t.overdue ? theme.danger : theme.muted)]}>
              {t.overdue ? props.labels.overdue : t.due || t.subject}
            </Text>
          ) : null}
        </HStack>
      ))}
      {hidden > 0 ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>
          {`+${hidden}`}
        </Text>
      ) : null}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('TasksWidget', TasksWidget);
