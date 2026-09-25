import { Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Il te reste » (petit, et écran verrouillé) : ce qu'il reste et ce qu'on peut dépenser par jour. */
const MoneyLeftWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const money = props.money;
  const family = environment.widgetFamily;

  if (family === 'accessoryInline') {
    return <Text modifiers={[widgetURL(money.url)]}>{`${money.labels.left} ${money.left}`}</Text>;
  }
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL(money.expenseUrl)]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{money.labels.left}</Text>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), lineLimit(1)]}>{money.left}</Text>
        <Text modifiers={[font({ size: 11 })]}>{money.perDay}</Text>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground(theme.primary, 'widget'), padding({ all: 2 }), widgetURL(money.url)]}
    >
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.onPrimary)]}>
        {money.labels.left.toUpperCase()}
      </Text>
      <Text modifiers={[font({ size: 22, weight: 'bold' }), foregroundStyle(theme.onPrimary), lineLimit(1)]}>
        {money.ready ? money.left : money.labels.start}
      </Text>
      <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.onPrimary)]}>{money.ready ? money.perDay : ''}</Text>
      <Spacer />
      <Link destination={money.expenseUrl}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(theme.onPrimary)]}>
          {`− ${money.labels.expense}`}
        </Text>
      </Link>
    </VStack>
  );
};

export default createWidget<WidgetData>('MoneyLeftWidget', MoneyLeftWidget);
