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

/**
 * Widget « Prochain cours » (petit, moyen, et écran verrouillé).
 * Règle expo-widgets : tout ce qui est utilisé ici doit venir des props ou être déclaré
 * DANS la fonction (le corps est compilé à part, sans accès au reste de l'app).
 */
const NextCourseWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const next = props.next;
  const family = environment.widgetFamily;

  if (family === 'accessoryInline') {
    return (
      <Text modifiers={[widgetURL(props.url)]}>
        {next ? `${next.start} · ${next.title}` : props.labels.noCourse}
      </Text>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(props.url)]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{props.labels.nextCourse}</Text>
        <Text modifiers={[font({ size: 14, weight: 'bold' }), lineLimit(1)]}>
          {next ? next.title : props.labels.noCourse}
        </Text>
        {next ? (
          <Text modifiers={[font({ size: 12 })]}>
            {`${next.start} – ${next.end}${next.room ? ` · ${next.room}` : ''}`}
          </Text>
        ) : null}
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        containerBackground(theme.surface, 'widget'),
        padding({ all: family === 'systemSmall' ? 2 : 4 }),
        widgetURL(props.url),
      ]}
    >
      <Text
        modifiers={[
          font({ size: 11, weight: 'bold' }),
          foregroundStyle(next && next.ongoing ? theme.success : theme.primary),
        ]}
      >
        {(next && next.ongoing ? props.labels.ongoing : props.labels.nextCourse).toUpperCase()}
      </Text>
      <Text
        modifiers={[
          font({ size: family === 'systemSmall' ? 17 : 20, weight: 'bold' }),
          foregroundStyle(theme.text),
          lineLimit(2),
        ]}
      >
        {next ? next.title : props.labels.noCourse}
      </Text>
      {next ? (
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(theme.text)]}>
          {`${next.start} – ${next.end}`}
        </Text>
      ) : null}
      {next && next.room ? (
        <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.muted)]}>{next.room}</Text>
      ) : null}
      <Spacer />
      <HStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>
          {next ? props.labels.startsIn : props.date}
        </Text>
        <Spacer />
        {family !== 'systemSmall' && next ? (
          <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>{props.date}</Text>
        ) : null}
      </HStack>
    </VStack>
  );
};

export default createWidget<WidgetData>('NextCourseWidget', NextCourseWidget);
