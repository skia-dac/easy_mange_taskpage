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

/** Widget « Examens » (petit, moyen) : compte à rebours des prochains examens. */
const ExamsWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const small = environment.widgetFamily === 'systemSmall';
  const exams = props.upcomingExams.slice(0, small ? 1 : 3);
  const first = exams[0];

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.tasks)]}
    >
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.danger)]}>
        {props.labels.exams.toUpperCase()}
      </Text>
      {!first ? (
        <Text modifiers={[font({ size: 14 }), foregroundStyle(theme.muted)]}>{props.labels.noExam}</Text>
      ) : null}
      {small && first ? (
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(theme.text)]}>{first.when}</Text>
          <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(theme.text), lineLimit(2)]}>
            {first.title}
          </Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>{first.date}</Text>
        </VStack>
      ) : null}
      {!small
        ? exams.map((e, i) => (
            <HStack key={`e${i}`} spacing={8}>
              <VStack alignment="leading" spacing={1}>
                <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(theme.text), lineLimit(1)]}>
                  {e.title}
                </Text>
                <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>
                  {e.title === e.subject ? e.date : `${e.subject} · ${e.date}`}
                </Text>
              </VStack>
              <Spacer />
              <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(i === 0 ? theme.danger : theme.primary)]}>
                {e.when}
              </Text>
            </HStack>
          ))
        : null}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('ExamsWidget', ExamsWidget);
