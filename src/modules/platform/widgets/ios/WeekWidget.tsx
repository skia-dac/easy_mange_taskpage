import { HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Semaine » (moyen, grand) : minutes de révision par jour, total et série de jours actifs. */
const WeekWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const large = environment.widgetFamily === 'systemLarge';
  const barHeight = large ? 90 : 48;
  const week = props.week;

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.study)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
          {props.labels.week.toUpperCase()}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(theme.text)]}>
          {week.streak}
        </Text>
      </HStack>
      <HStack alignment="bottom" spacing={6}>
        {week.days.map((d, i) => (
          <VStack key={`d${i}`} spacing={3}>
            <Spacer />
            <RoundedRectangle
              cornerRadius={4}
              modifiers={[
                frame({ height: Math.max(4, Math.round((Math.min(d.minutes, week.max) / week.max) * barHeight)), maxWidth: 40 }),
                foregroundStyle(d.today ? theme.primary : d.minutes > 0 ? theme.success : theme.primarySoft),
              ]}
            />
            <Text modifiers={[font({ size: 10 }), foregroundStyle(d.today ? theme.text : theme.muted)]}>
              {d.label}
            </Text>
          </VStack>
        ))}
      </HStack>
      <HStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>{props.labels.weekTotal}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(theme.text)]}>{week.total}</Text>
      </HStack>
      {large ? (
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary), padding({ top: 6 })]}>
            {props.labels.tasks.toUpperCase()}
          </Text>
          {props.tasks.slice(0, 4).map((t, i) => (
            <HStack key={`t${i}`}>
              <Text modifiers={[font({ size: 13 }), foregroundStyle(t.overdue ? theme.danger : theme.text)]}>
                {t.title}
              </Text>
              <Spacer />
              <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>{t.subject}</Text>
            </HStack>
          ))}
          {props.tasks.length === 0 ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.muted)]}>{props.labels.noTask}</Text>
          ) : null}
        </VStack>
      ) : null}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('WeekWidget', WeekWidget);
