import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

/**
 * Widget « Dépense rapide » (moyen) : une catégorie touchée ouvre la saisie avec cette catégorie
 * déjà choisie, il ne reste qu'à taper le montant. (Un widget ne peut pas recevoir de texte.)
 */
const MoneyQuickWidget = (props: WidgetData, environment: WidgetEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const money = props.money;

  return (
    <VStack alignment="leading" spacing={8} modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 })]}>
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
          {money.labels.quick.toUpperCase()}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>
          {money.ready ? `${money.labels.today} ${money.todaySpent}` : ''}
        </Text>
      </HStack>
      <HStack spacing={6}>
        {money.quick.map((b, i) => (
          <Link key={`q${i}`} destination={b.url}>
            <VStack
              spacing={4}
              modifiers={[
                frame({ maxWidth: 200, minHeight: 64 }),
                background(theme.primarySoft, shapes.roundedRectangle({ cornerRadius: 12 })),
                padding({ all: 4 }),
              ]}
            >
              <Image systemName={b.symbol as 'cart'} size={18} color={theme.primary} />
              <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(theme.text)]}>{b.label}</Text>
            </VStack>
          </Link>
        ))}
      </HStack>
      <Link destination={money.incomeUrl}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(theme.success)]}>
          {`+ ${money.labels.income}`}
        </Text>
      </Link>
    </VStack>
  );
};

export default createWidget<WidgetData>('MoneyQuickWidget', MoneyQuickWidget);
