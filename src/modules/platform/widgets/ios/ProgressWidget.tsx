import { HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/**
 * Widget « Progression » (façon GitHub) : petit = le mois en cours ; moyen et grand = les
 * 26 dernières semaines. Plus la case est foncée, plus l'habitude a été tenue ce jour-là.
 */
const ProgressWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const family = environment.widgetFamily;
  const p = props.progress;
  const small = family === 'systemSmall';
  const size = family === 'systemLarge' ? 10 : 9;
  const weeks = small ? p.month : p.weeks;
  const color = (level: number) =>
    level < 0 ? (level === -2 ? theme.surface : theme.background) : (theme.heat[level] ?? theme.muted);

  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.habits)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary), lineLimit(1)]}>
          {(small ? p.monthTitle : p.title).toUpperCase()}
        </Text>
        <Spacer />
      </HStack>
      {!p.hasHabit ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.muted)]}>{props.labels.noHabit}</Text>
      ) : small ? (
        <VStack spacing={3}>
          {weeks.map((week, w) => (
            <HStack key={`w${w}`} spacing={3}>
              {week.map((level, d) => (
                <RoundedRectangle
                  key={`d${d}`}
                  cornerRadius={3}
                  modifiers={[frame({ width: 16, height: 16 }), foregroundStyle(color(level))]}
                />
              ))}
            </HStack>
          ))}
        </VStack>
      ) : (
        <HStack spacing={3}>
          {weeks.map((week, w) => (
            <VStack key={`w${w}`} spacing={3}>
              {week.map((level, d) => (
                <RoundedRectangle
                  key={`d${d}`}
                  cornerRadius={2}
                  modifiers={[frame({ width: size, height: size }), foregroundStyle(color(level))]}
                />
              ))}
            </VStack>
          ))}
        </HStack>
      )}
      <Spacer />
      <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted), lineLimit(1)]}>
        {small ? p.summary : `${p.summary} · ${p.title}`}
      </Text>
    </VStack>
  );
};

export default createWidget<WidgetData>('ProgressWidget', ProgressWidget);
