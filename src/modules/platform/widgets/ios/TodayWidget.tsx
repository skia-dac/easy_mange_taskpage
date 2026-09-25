import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  padding,
  strikethrough,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Aujourd'hui » (moyen, grand) : les séances du jour, puis les tâches et examens. */
const TodayWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const large = environment.widgetFamily === 'systemLarge';
  const courses = large ? props.courses : props.courses.slice(0, 3);
  const tasks = large ? props.tasks.slice(0, 3) : [];
  const exams = large ? props.exams.slice(0, 2) : [];

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.url)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
          {props.labels.today.toUpperCase()}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>{props.date}</Text>
      </HStack>
      {courses.length === 0 ? (
        <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.muted)]}>
          {props.labels.noCourse}
        </Text>
      ) : null}
      {courses.map((c, i) => (
        <HStack key={`c${i}`} spacing={8} alignment="firstTextBaseline">
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold', design: 'monospaced' }),
              foregroundStyle(c.ongoing ? theme.success : theme.muted),
            ]}
          >
            {c.start}
          </Text>
          <Text
            modifiers={[
              font({ size: 14, weight: c.ongoing ? 'bold' : 'medium' }),
              foregroundStyle(c.cancelled ? theme.muted : theme.text),
              lineLimit(1),
              ...(c.cancelled ? [strikethrough({ isActive: true, pattern: 'solid' })] : []),
            ]}
          >
            {c.title}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>
            {c.cancelled ? props.labels.cancelled : c.room}
          </Text>
        </HStack>
      ))}
      {tasks.length > 0 ? (
        <Text
          modifiers={[
            font({ size: 11, weight: 'bold' }),
            foregroundStyle(theme.primary),
            padding({ top: 4 }),
          ]}
        >
          {props.labels.tasks.toUpperCase()}
        </Text>
      ) : null}
      {tasks.map((t, i) => (
        <HStack key={`t${i}`} spacing={8}>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(t.overdue ? theme.danger : theme.text), lineLimit(1)]}>
            {t.title}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle(t.overdue ? theme.danger : theme.muted)]}>
            {t.overdue ? props.labels.overdue : t.subject}
          </Text>
        </HStack>
      ))}
      {exams.length > 0 ? (
        <Text
          modifiers={[
            font({ size: 11, weight: 'bold' }),
            foregroundStyle(theme.primary),
            padding({ top: 4 }),
          ]}
        >
          {props.labels.exams.toUpperCase()}
        </Text>
      ) : null}
      {exams.map((e, i) => (
        <HStack key={`e${i}`} spacing={8}>
          <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.text), lineLimit(1)]}>
            {e.title}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(theme.primary)]}>
            {e.when}
          </Text>
        </HStack>
      ))}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('TodayWidget', TodayWidget);
