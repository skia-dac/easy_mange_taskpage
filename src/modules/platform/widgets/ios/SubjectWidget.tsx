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

type Configuration = { subject: string };

/**
 * Widget « Matière » (petit, moyen), configurable : appui long → « Matière » → nom de la matière.
 * Sans nom, la première matière est affichée.
 */
const SubjectWidget = (props: WidgetData, environment: WidgetEnvironment<Configuration>) => {
  'widget';
  const theme = environment.colorScheme === 'dark' ? props.dark : props.light;
  const wanted = (environment.configuration?.subject ?? '').trim().toLowerCase();
  const subject =
    (wanted ? props.subjects.find((s) => s.name.toLowerCase().includes(wanted)) : undefined) ??
    props.subjects[0];
  const small = environment.widgetFamily === 'systemSmall';

  if (!subject) {
    return (
      <VStack modifiers={[containerBackground(theme.surface, 'widget'), widgetURL(props.links.app)]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(theme.muted)]}>{props.labels.subjectNone}</Text>
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={5}
      modifiers={[containerBackground(theme.surface, 'widget'), padding({ all: 2 }), widgetURL(props.links.app)]}
    >
      <HStack spacing={6}>
        <Circle modifiers={[frame({ width: 10, height: 10 }), foregroundStyle(subject.color)]} />
        <Text
          modifiers={[font({ size: small ? 15 : 17, weight: 'bold' }), foregroundStyle(theme.text), lineLimit(1)]}
        >
          {subject.name}
        </Text>
        <Spacer />
        {subject.average ? (
          <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(theme.success)]}>
            {`${subject.average}/20`}
          </Text>
        ) : null}
      </HStack>
      <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(theme.primary)]}>
        {props.labels.nextCourse.toUpperCase()}
      </Text>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(theme.text)]}>
        {subject.nextCourse
          ? `${subject.nextCourse}${subject.nextCourseRoom ? ` · ${subject.nextCourseRoom}` : ''}`
          : props.labels.noCourse}
      </Text>
      {!small || subject.nextDue ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(subject.openTasks > 0 ? theme.text : theme.muted), lineLimit(1)]}>
          {subject.nextDue || props.labels.noTask}
        </Text>
      ) : null}
      {!small && subject.nextExam ? (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(theme.danger)]}>
          {`${props.labels.exams} · ${subject.nextExam}`}
        </Text>
      ) : null}
      <Spacer />
      {subject.openTasks > 0 ? (
        <Text modifiers={[font({ size: 11 }), foregroundStyle(theme.muted)]}>
          {`${subject.openTasks} · ${props.labels.tasks}`}
        </Text>
      ) : null}
    </VStack>
  );
};

export default createWidget<WidgetData, Configuration>('SubjectWidget', SubjectWidget);
