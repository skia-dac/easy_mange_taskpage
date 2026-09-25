import { Circle, HStack, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Mois » (grand) : le mois en cours, avec un point sous les jours qui ont un cours, une échéance ou un examen. */
const MonthWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const m = props.month;
  const rows = [0, 1, 2, 3, 4, 5].map((r) => m.cells.slice(r * 7, r * 7 + 7));

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.calendar)]}
    >
      <HStack>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(theme.text)]}>{m.title}</Text>
        <Spacer />
        {props.next ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>
            {`${props.next.start} · ${props.next.title}`}
          </Text>
        ) : null}
      </HStack>
      <HStack spacing={0}>
        {m.weekdays.map((d, i) => (
          <Text key={`w${i}`} modifiers={[font({ size: 9, weight: 'semibold' }), foregroundStyle(theme.muted), frame({ maxWidth: 200 })]}>
            {d}
          </Text>
        ))}
      </HStack>
      {rows.map((row, r) => (
        <HStack key={`r${r}`} spacing={0}>
          {row.map((c, i) => (
            <VStack key={`c${i}`} spacing={1} modifiers={[frame({ maxWidth: 200 })]}>
              <ZStack>
                {c.today ? (
                  <Circle modifiers={[frame({ width: 22, height: 22 }), foregroundStyle(theme.primary)]} />
                ) : null}
                <Text
                  modifiers={[
                    font({ size: 12, weight: c.today ? 'bold' : 'regular' }),
                    foregroundStyle(c.today ? theme.surface : c.inMonth ? theme.text : theme.muted),
                    frame({ width: 22, height: 22 }),
                  ]}
                >
                  {String(c.day)}
                </Text>
              </ZStack>
              <HStack spacing={2}>
                {c.course ? <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle(theme.primary)]} /> : null}
                {c.due ? <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle(theme.success)]} /> : null}
                {c.exam ? <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle(theme.danger)]} /> : null}
                {!c.course && !c.due && !c.exam ? (
                  <Circle modifiers={[frame({ width: 4, height: 4 }), foregroundStyle(theme.surface)]} />
                ) : null}
              </HStack>
            </VStack>
          ))}
        </HStack>
      ))}
      <Spacer />
      <HStack spacing={10} modifiers={[background(theme.background, shapes.roundedRectangle({ cornerRadius: 12 })), padding({ all: 4 })]}>
        <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(theme.primary)]} />
        <Text modifiers={[font({ size: 10 }), foregroundStyle(theme.muted)]}>{props.labels.nextCourse}</Text>
        <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(theme.success)]} />
        <Text modifiers={[font({ size: 10 }), foregroundStyle(theme.muted)]}>{props.labels.tasks}</Text>
        <Circle modifiers={[frame({ width: 6, height: 6 }), foregroundStyle(theme.danger)]} />
        <Text modifiers={[font({ size: 10 }), foregroundStyle(theme.muted)]}>{props.labels.exams}</Text>
      </HStack>
    </VStack>
  );
};

export default createWidget<WidgetData>('MonthWidget', MonthWidget);
