import { HStack, Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Notes rapides » (moyen) : trois boutons qui ouvrent directement une nouvelle note, tâche ou devoir. */
const QuickAddWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const buttons = [
    { label: props.labels.quickNote, icon: 'square.and.pencil' as const, url: props.links.note },
    { label: props.labels.quickTask, icon: 'checkmark.circle' as const, url: props.links.task },
    { label: props.labels.quickAssignment, icon: 'book' as const, url: props.links.assignment },
  ];

  return (
    <HStack spacing={8} modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 })]}>
      {buttons.map((b, i) => (
        <Link key={`b${i}`} destination={b.url}>
          <VStack
            spacing={6}
            modifiers={[
              frame({ maxWidth: 200, minHeight: 88 }),
              background(theme.primarySoft, shapes.roundedRectangle({ cornerRadius: 12 })),
              padding({ all: 8 }),
            ]}
          >
            <Image systemName={b.icon} size={22} color={theme.primary} />
            <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(theme.text)]}>{b.label}</Text>
          </VStack>
        </Link>
      ))}
    </HStack>
  );
};

export default createWidget<WidgetData>('QuickAddWidget', QuickAddWidget);
