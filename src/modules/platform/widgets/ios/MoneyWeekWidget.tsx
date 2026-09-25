import { HStack, RoundedRectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetData } from '@/projections';

/** Widget « Ma semaine » (petit, moyen) : dépenses des 7 derniers jours ; en moyen, ce qui est à payer. */
const MoneyWeekWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const money = props.money;
  const medium = environment.widgetFamily === 'systemMedium';
  const barHeight = 44;

  const week = (
    <VStack alignment="leading" spacing={6}>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
        {money.labels.week.toUpperCase()}
      </Text>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(theme.text)]}>{money.weekTotal}</Text>
      <HStack alignment="bottom" spacing={4}>
        {money.week.map((d, i) => (
          <VStack key={`d${i}`} spacing={2}>
            <Spacer />
            <RoundedRectangle
              cornerRadius={3}
              modifiers={[
                frame({ height: Math.max(3, Math.round((d.value / money.weekMax) * barHeight)), maxWidth: 16 }),
                foregroundStyle(d.today ? theme.primary : theme.primarySoft),
              ]}
            />
            <Text modifiers={[font({ size: 9 }), foregroundStyle(theme.muted)]}>{d.label}</Text>
          </VStack>
        ))}
      </HStack>
    </VStack>
  );

  return (
    <HStack spacing={12} modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(money.url)]}>
      {week}
      {medium ? (
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.warning)]}>
            {money.labels.due.toUpperCase()}
          </Text>
          {money.due.map((d, i) => (
            <VStack key={`u${i}`} alignment="leading" spacing={0}>
              <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(theme.text)]}>{d.name}</Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>{`${d.when} · ${d.amount}`}</Text>
            </VStack>
          ))}
          {money.due.length === 0 ? (
            <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>{money.labels.noDue}</Text>
          ) : null}
          <Spacer />
        </VStack>
      ) : null}
    </HStack>
  );
};

export default createWidget<WidgetData>('MoneyWeekWidget', MoneyWeekWidget);
