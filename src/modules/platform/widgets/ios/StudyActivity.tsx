import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

import type { WidgetLabels, WidgetStudy, WidgetTheme } from '@/projections';

export type StudyActivityProps = {
  study: WidgetStudy;
  labels: Pick<WidgetLabels, 'studyRunning' | 'breakRunning' | 'untilTime'>;
  light: WidgetTheme;
  dark: WidgetTheme;
};

/**
 * Live Activity « Révision » : compte à rebours en direct sur l'écran verrouillé et dans la
 * Dynamic Island pendant une session (ou une pause). Le minuteur est tenu par le système.
 */
const StudyActivity = (props: StudyActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const isBreak = props.study.kind === 'break';
  const accent = environment.isLuminanceReduced ? theme.text : isBreak ? theme.success : theme.primary;
  const range = { lower: new Date(props.study.startedAt), upper: new Date(props.study.endsAt) };
  const title = isBreak ? props.labels.breakRunning : props.labels.studyRunning;
  const icon = isBreak ? 'cup.and.saucer.fill' : 'book.fill';

  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 14 })]}>
        <Image systemName={icon} size={28} color={accent} />
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(accent)]}>
            {title.toUpperCase()}
          </Text>
          <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle(theme.text)]}>
            {props.study.subject || `${props.study.plannedMinutes} min`}
          </Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted)]}>
            {`${props.labels.untilTime} ${props.study.endsAtTime}`}
          </Text>
        </VStack>
        <Spacer />
        <Text
          timerInterval={range}
          countsDown
          modifiers={[font({ size: 34, weight: 'bold', design: 'rounded' }), foregroundStyle(theme.text)]}
        />
      </HStack>
    ),
    compactLeading: <Image systemName={icon} color={accent} />,
    compactTrailing: (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[font({ size: 14, weight: 'semibold', design: 'rounded' }), foregroundStyle(accent)]}
      />
    ),
    minimal: <Image systemName={icon} color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(accent)]}>{title}</Text>
        <Text modifiers={[font({ size: 14, weight: 'bold' })]}>
          {props.study.subject || `${props.study.plannedMinutes} min`}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" modifiers={[padding({ all: 10 })]}>
        <Text
          timerInterval={range}
          countsDown
          modifiers={[font({ size: 26, weight: 'bold', design: 'rounded' })]}
        />
      </VStack>
    ),
    expandedBottom: (
      <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.muted), padding({ horizontal: 10, bottom: 8 })]}>
        {`${props.labels.untilTime} ${props.study.endsAtTime}`}
      </Text>
    ),
  };
};

export default createLiveActivity<StudyActivityProps>('StudyActivity', StudyActivity);
