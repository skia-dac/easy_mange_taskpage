import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetTheme } from '@/projections';

/** Noms déclarés dans app.json (plugin react-native-android-widget). */
export const ANDROID_WIDGETS = ['NextCourse', 'Today', 'Tasks'] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGETS)[number];

/** react-native-android-widget exige des couleurs hexadécimales (c'est le cas de tout colors.ts). */
type AndroidTheme = Record<keyof WidgetTheme, `#${string}`>;
type Props = { data: WidgetData; theme: AndroidTheme };

function asAndroidTheme(theme: WidgetTheme): AndroidTheme {
  const out = {} as AndroidTheme;
  for (const key of Object.keys(theme) as (keyof WidgetTheme)[]) {
    const value = theme[key];
    out[key] = (value.startsWith('#') ? value : `#${value}`) as `#${string}`;
  }
  return out;
}

const CLICK = { clickAction: 'OPEN_URI' as const };

function Header({ title, right, theme }: { title: string; right: string; theme: AndroidTheme }) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between' }}
    >
      <TextWidget
        text={title.toUpperCase()}
        style={{ fontSize: 11, fontWeight: 'bold', color: theme.primary, letterSpacing: 0.5 }}
      />
      <TextWidget text={right} style={{ fontSize: 11, color: theme.muted }} />
    </FlexWidget>
  );
}

/** Carte de fond commune : même arrondi et même fond que les cartes de l'app. */
function Card({ children, data, theme }: Props & { children: React.ReactNode }) {
  return (
    <FlexWidget
      {...CLICK}
      clickActionData={{ uri: data.url }}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: theme.surface,
        borderRadius: 20,
        padding: 14,
        flexDirection: 'column',
        flexGap: 6,
      }}
    >
      {children}
    </FlexWidget>
  );
}

export function NextCourseWidget({ data, theme }: Props) {
  const next = data.next;
  return (
    <Card data={data} theme={theme}>
      <TextWidget
        text={(next && next.ongoing ? data.labels.ongoing : data.labels.nextCourse).toUpperCase()}
        style={{
          fontSize: 11,
          fontWeight: 'bold',
          color: next && next.ongoing ? theme.success : theme.primary,
          letterSpacing: 0.5,
        }}
      />
      <TextWidget
        text={next ? next.title : data.labels.noCourse}
        maxLines={2}
        truncate="END"
        style={{ fontSize: 19, fontWeight: 'bold', color: theme.text }}
      />
      {next ? (
        <TextWidget
          text={`${next.start} – ${next.end}${next.room ? `  ·  ${next.room}` : ''}`}
          style={{ fontSize: 14, fontWeight: '600', color: theme.text }}
        />
      ) : null}
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget
        text={next ? `${data.labels.startsIn}  ·  ${data.date}` : data.date}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: theme.muted }}
      />
    </Card>
  );
}

export function TodayWidget({ data, theme }: Props) {
  return (
    <Card data={data} theme={theme}>
      <Header title={data.labels.today} right={data.date} theme={theme} />
      {data.courses.length === 0 ? (
        <TextWidget text={data.labels.noCourse} style={{ fontSize: 14, color: theme.muted }} />
      ) : null}
      {data.courses.map((c, i) => (
        <FlexWidget
          key={`c${i}`}
          style={{ width: 'match_parent', flexDirection: 'row', flexGap: 8, alignItems: 'center' }}
        >
          <TextWidget
            text={c.start}
            style={{ fontSize: 13, fontWeight: '600', color: c.ongoing ? theme.success : theme.muted }}
          />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={c.title}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 14, fontWeight: c.ongoing ? 'bold' : '500', color: c.cancelled ? theme.muted : theme.text }}
            />
          </FlexWidget>
          <TextWidget
            text={c.cancelled ? data.labels.cancelled : c.room}
            style={{ fontSize: 12, color: theme.muted }}
          />
        </FlexWidget>
      ))}
      {data.tasks.length > 0 ? (
        <TextWidget
          text={data.labels.tasks.toUpperCase()}
          style={{ fontSize: 11, fontWeight: 'bold', color: theme.primary, marginTop: 4 }}
        />
      ) : null}
      {data.tasks.slice(0, 3).map((t, i) => (
        <FlexWidget
          key={`t${i}`}
          style={{ width: 'match_parent', flexDirection: 'row', flexGap: 8, alignItems: 'center' }}
        >
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={t.title}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 14, color: t.overdue ? theme.danger : theme.text }}
            />
          </FlexWidget>
          <TextWidget
            text={t.overdue ? data.labels.overdue : t.subject}
            style={{ fontSize: 12, color: t.overdue ? theme.danger : theme.muted }}
          />
        </FlexWidget>
      ))}
      {data.exams.length > 0 ? (
        <TextWidget
          text={data.labels.exams.toUpperCase()}
          style={{ fontSize: 11, fontWeight: 'bold', color: theme.primary, marginTop: 4 }}
        />
      ) : null}
      {data.exams.map((e, i) => (
        <FlexWidget
          key={`e${i}`}
          style={{ width: 'match_parent', flexDirection: 'row', flexGap: 8, alignItems: 'center' }}
        >
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={e.title} maxLines={1} truncate="END" style={{ fontSize: 14, color: theme.text }} />
          </FlexWidget>
          <TextWidget text={e.when} style={{ fontSize: 12, fontWeight: '600', color: theme.primary }} />
        </FlexWidget>
      ))}
    </Card>
  );
}

export function TasksWidget({ data, theme }: Props) {
  const total = data.tasks.length + data.moreTasks;
  return (
    <Card data={data} theme={theme}>
      <Header title={data.labels.tasks} right={String(total)} theme={theme} />
      {data.tasks.length === 0 ? (
        <TextWidget text={data.labels.noTask} style={{ fontSize: 14, color: theme.muted }} />
      ) : null}
      {data.tasks.map((t, i) => (
        <FlexWidget
          key={`t${i}`}
          style={{ width: 'match_parent', flexDirection: 'row', flexGap: 8, alignItems: 'center' }}
        >
          <TextWidget text="○" style={{ fontSize: 13, color: t.overdue ? theme.danger : theme.primary }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={t.title} maxLines={1} truncate="END" style={{ fontSize: 14, color: theme.text }} />
          </FlexWidget>
          <TextWidget
            text={t.overdue ? data.labels.overdue : t.due || t.subject}
            style={{ fontSize: 12, color: t.overdue ? theme.danger : theme.muted }}
          />
        </FlexWidget>
      ))}
      {data.moreTasks > 0 ? (
        <TextWidget text={`+${data.moreTasks}`} style={{ fontSize: 12, color: theme.muted }} />
      ) : null}
    </Card>
  );
}

export function renderAndroidWidget(name: AndroidWidgetName, data: WidgetData) {
  const Widget =
    name === 'NextCourse' ? NextCourseWidget : name === 'Today' ? TodayWidget : TasksWidget;
  return {
    light: <Widget data={data} theme={asAndroidTheme(data.light)} />,
    dark: <Widget data={data} theme={asAndroidTheme(data.dark)} />,
  };
}
