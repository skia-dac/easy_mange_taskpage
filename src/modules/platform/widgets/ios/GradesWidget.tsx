import { Circle, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

/** Widget « Moyenne » (petit, moyen) : moyenne générale, dernière note, moyennes par matière. */
const GradesWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const small = environment.widgetFamily === 'systemSmall';
  const g = props.grades;

  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.grades)]}
    >
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.success)]}>
        {props.labels.overall.toUpperCase()}
      </Text>
      <Text modifiers={[font({ size: small ? 30 : 34, weight: 'bold', design: 'rounded' }), foregroundStyle(theme.text)]}>
        {g.overall ? `${g.overall}/20` : '—'}
      </Text>
      {g.last ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted), lineLimit(1)]}>
          {`${props.labels.lastGrade} : ${g.last.value}/20 · ${g.last.title}`}
        </Text>
      ) : (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>{props.labels.noGrade}</Text>
      )}
      {!small
        ? g.subjects.slice(0, 3).map((s, i) => (
            <HStack key={`s${i}`} spacing={6}>
              <Circle modifiers={[frame({ width: 8, height: 8 }), foregroundStyle(s.color)]} />
              <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.text), lineLimit(1)]}>{s.name}</Text>
              <Spacer />
              <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(theme.text)]}>
                {`${s.average}/20`}
              </Text>
            </HStack>
          ))
        : null}
      <Spacer />
    </VStack>
  );
};

export default createWidget<WidgetData>('GradesWidget', GradesWidget);
