import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { colorOf, type Subject } from '@/modules/academic';
import { eventHref } from '@/components/eventHref';
import { SpaceTag } from '@/components/SpaceUi';
import { blockMinutes, isSlotEvent, workSpace } from '@/modules/productivity';
import type { DayEntry, DayLine, NextCourse } from '@/projections';
import { toTime } from '@/shared/dates';
import { formatDuration } from '@/shared/format';
import type { SpaceId } from '@/shared/spaces';
import { minTouchSize, useTheme, fonts } from '@/shared/theme';
import { AppText, SectionHeader } from '@/shared/ui';

const TIME_WIDTH = 46;

/**
 * « Ta journée » : tout ce qui a une heure aujourd'hui sur une seule ligne du temps, avec le
 * trait « maintenant ». Le prochain cours (ou celui en cours) est mis en avant.
 */
export function DayLineCard({
  line,
  next,
  now,
  subjects,
}: {
  line: DayLine;
  next: NextCourse | null;
  now: Date;
  subjects: ReadonlyMap<string, Subject>;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const nextKey = next
    ? `course-${next.occurrence.seriesId}-${next.occurrence.originalDate}`
    : null;
  const total = line.entries.length;

  return (
    <>
      <SectionHeader
        title={t('dayline.title')}
        action={{
          label: t('dayline.calendar'),
          onPress: () => router.navigate('/(tabs)/calendar'),
        }}
      />
      {line.allDay.map((e) => (
        <Row key={e.key} entry={e} subjects={subjects} past={false} last />
      ))}
      {total === 0 ? (
        <AppText color="muted">{t('dayline.empty')}</AppText>
      ) : (
        <View style={{ gap: 0 }}>
          {line.entries.map((e, i) => (
            <Fragment key={e.key}>
              {i === line.nowIndex ? <NowLine now={now} /> : null}
              {e.key === nextKey && next ? (
                <NextRow entry={e} next={next} subjects={subjects} last={i === total - 1} />
              ) : (
                <Row
                  entry={e}
                  subjects={subjects}
                  past={line.pastKeys.has(e.key)}
                  last={i === total - 1}
                />
              )}
            </Fragment>
          ))}
          {line.nowIndex === total ? <NowLine now={now} /> : null}
        </View>
      )}
      <View style={{ height: spacing.xs }} />
    </>
  );
}

function NowLine({ now }: { now: Date }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View
      accessibilityLabel={t('dayline.nowA11y', { time: toTime(now) })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: 28,
        marginVertical: spacing.xs,
      }}
    >
      <AppText
        variant="caption"
        color="danger"
        style={{ width: TIME_WIDTH, fontFamily: fonts.bodyBold }}
      >
        {toTime(now)}
      </AppText>
      <View style={{ flex: 1, height: 2, backgroundColor: colors.danger, borderRadius: 1 }} />
      <AppText variant="caption" color="danger" style={{ fontFamily: fonts.bodyBold }}>
        {t('dayline.now')}
      </AppText>
    </View>
  );
}

/** Colonne de gauche : l'heure, puis un point et le trait qui relie au moment suivant. */
function Rail({
  time,
  dot,
  hollow,
  last,
  muted,
}: {
  time: string | null;
  dot: string;
  hollow?: boolean;
  last: boolean;
  muted: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <>
      <AppText
        variant="bodyStrong"
        color={muted ? 'muted' : 'text'}
        style={{ width: TIME_WIDTH, paddingTop: spacing.sm }}
      >
        {time ?? ''}
      </AppText>
      <View style={{ width: 12, alignItems: 'center', paddingTop: spacing.md }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: hollow ? colors.background : dot,
            borderWidth: hollow ? 2 : 0,
            borderColor: dot,
          }}
        />
        {last ? null : (
          <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 }} />
        )}
      </View>
    </>
  );
}

function Row({
  entry,
  subjects,
  past,
  last,
}: {
  entry: DayEntry;
  subjects: ReadonlyMap<string, Subject>;
  past: boolean;
  last: boolean;
}) {
  const { t } = useTranslation();
  const { colors, scheme, spacing } = useTheme();
  const labels = useLabels();
  const strong = (s: Subject | undefined) =>
    scheme === 'dark' ? colorOf(s).strongDark : colorOf(s).strong;

  let title = '';
  let detail = '';
  let dot: string = colors.primary;
  let hollow = false;
  let href: Href;
  switch (entry.kind) {
    case 'course': {
      const o = entry.occurrence;
      const s = subjects.get(o.subjectId);
      title = o.title ?? s?.name ?? '';
      detail = [`${o.startTime} – ${o.endTime}`, labels.courseType(o.courseType), o.room]
        .filter(Boolean)
        .join(' · ');
      dot = strong(s);
      href = { pathname: '/courses/[id]', params: { id: o.seriesId, date: o.originalDate } };
      break;
    }
    case 'revision': {
      const b = entry.block;
      const s = b.subjectId ? subjects.get(b.subjectId) : undefined;
      title = b.title ?? t('dayline.revision', { name: s?.name ?? '' }).trim();
      detail = [formatDuration(blockMinutes(b)), b.status === 'done' ? t('dayline.done') : null]
        .filter(Boolean)
        .join(' · ');
      dot = strong(s);
      href = { pathname: '/revision/[id]', params: { id: b.id } };
      break;
    }
    case 'event': {
      const e = entry.event;
      title = e.title;
      detail = entry.start
        ? [
            isSlotEvent(e) ? t('planning.slot') : t('dayline.event'),
            entry.end ? `${entry.start} – ${entry.end}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : t('dayline.allDay');
      dot = colors.warning;
      href = eventHref(e);
      break;
    }
    case 'work': {
      const w = entry.item;
      const s = w.subjectId ? subjects.get(w.subjectId) : undefined;
      title = w.title;
      detail = [
        w.kind === 'task' ? t('add.task') : t('add.assignment'),
        s?.name,
        w.estimatedMinutes ? formatDuration(w.estimatedMinutes) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      hollow = true;
      href = { pathname: '/work/[id]', params: { id: w.id, kind: w.kind } };
      break;
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.start ?? t('dayline.allDay')}, ${title}${detail ? `, ${detail}` : ''}`}
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: spacing.md,
        minHeight: last ? minTouchSize + 8 : 60,
        opacity: pressed ? 0.7 : past ? 0.6 : 1,
      })}
    >
      <Rail time={entry.start} dot={dot} hollow={hollow} last={last} muted={past} />
      <View style={{ flex: 1, paddingTop: spacing.xs + 2, paddingBottom: spacing.sm }}>
        <AppText
          variant="bodyStrong"
          style={past ? { textDecorationLine: 'line-through' } : undefined}
          numberOfLines={2}
        >
          {title}
        </AppText>
        {detail ? (
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <View style={{ paddingTop: spacing.sm }}>
        <SpaceTag space={entrySpace(entry)} />
      </View>
    </Pressable>
  );
}

/** Espace d'un moment de la journée (étiquette quand plusieurs espaces sont actifs). */
function entrySpace(entry: DayEntry): SpaceId {
  switch (entry.kind) {
    case 'course':
    case 'revision':
      return 'study';
    case 'event':
      return entry.event.space;
    case 'work':
      return workSpace(entry.item);
  }
}

/** Le prochain cours (ou celui en cours) : une carte colorée, avec « Prendre des notes ». */
function NextRow({
  entry,
  next,
  subjects,
  last,
}: {
  entry: DayEntry;
  next: NextCourse;
  subjects: ReadonlyMap<string, Subject>;
  last: boolean;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const o = next.occurrence;
  const name = o.title ?? subjects.get(o.subjectId)?.name ?? '';
  const time = formatDuration(next.minutes);
  const when =
    next.state === 'ongoing' ? t('today.endsIn', { time }) : t('today.startsIn', { time });
  const where = [`${o.startTime} – ${o.endTime}`, o.room, o.teacher].filter(Boolean).join(' · ');

  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Rail time={entry.start} dot={colors.primary} last={last} muted={false} />
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderRadius: radius.lg,
          marginBottom: spacing.md,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${when} : ${name}, ${where}`}
          onPress={() =>
            router.push({
              pathname: '/courses/[id]',
              params: { id: o.seriesId, date: o.originalDate },
            })
          }
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            paddingRight: spacing.sm,
            gap: 2,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <AppText variant="label" color="onPrimary" style={{ letterSpacing: 1 }}>
            {when.toLocaleUpperCase()}
          </AppText>
          <AppText variant="heading" color="onPrimary" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="caption" color="onPrimary" numberOfLines={1}>
            {where}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('notes.takeNotes')}
          onPress={() =>
            router.push({
              pathname: '/notes/[id]',
              params: {
                id: 'new',
                subjectId: o.subjectId,
                courseSeriesId: o.seriesId,
                courseDate: o.originalDate,
              },
            })
          }
          style={({ pressed }) => ({
            width: minTouchSize,
            height: minTouchSize,
            marginRight: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.onPrimary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Feather name="edit-3" size={20} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}
