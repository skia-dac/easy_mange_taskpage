import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetData, WidgetTheme } from '@/projections';

/** Noms déclarés dans app.json (plugin react-native-android-widget). */
export const ANDROID_WIDGETS = [
  'NextCourse',
  'Today',
  'Tasks',
  'Study',
  'Week',
  'Subject',
  'Exams',
  'QuickAdd',
  'Grades',
  'Month',
  'Habits',
] as const;
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
function Card({
  children,
  data,
  theme,
  url,
}: Props & { children: React.ReactNode; url?: string }) {
  return (
    <FlexWidget
      {...CLICK}
      clickActionData={{ uri: url ?? data.url }}
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

const ROW = {
  width: 'match_parent' as const,
  flexDirection: 'row' as const,
  flexGap: 8,
  alignItems: 'center' as const,
};

export function StudyWidget({ data, theme }: Props) {
  const s = data.study;
  const running = s !== null;
  const isBreak = s?.kind === 'break';
  return (
    <Card data={data} theme={theme} url={data.links.study}>
      <TextWidget
        text={(running ? (isBreak ? data.labels.breakRunning : data.labels.studyRunning) : data.labels.study).toUpperCase()}
        style={{ fontSize: 11, fontWeight: 'bold', color: isBreak ? theme.success : theme.primary, letterSpacing: 0.5 }}
      />
      {s ? (
        <TextWidget
          text={`${data.labels.untilTime} ${s.endsAtTime}`}
          style={{ fontSize: 26, fontWeight: 'bold', color: theme.text }}
        />
      ) : (
        <TextWidget text={data.labels.studyIdle} style={{ fontSize: 15, fontWeight: '600', color: theme.text }} />
      )}
      <TextWidget
        text={s ? s.subject || `${s.plannedMinutes} min` : data.week.total}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 13, color: theme.muted }}
      />
      <FlexWidget style={{ flex: 1 }} />
      <FlexWidget
        {...CLICK}
        clickActionData={{ uri: data.links.study }}
        style={{ backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }}
      >
        <TextWidget
          text={running ? data.labels.study : data.labels.studyStart}
          style={{ fontSize: 13, fontWeight: '600', color: theme.surface }}
        />
      </FlexWidget>
    </Card>
  );
}

export function WeekWidget({ data, theme }: Props) {
  const w = data.week;
  const barHeight = 56;
  return (
    <Card data={data} theme={theme} url={data.links.study}>
      <Header title={data.labels.week} right={w.streak} theme={theme} />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 6, alignItems: 'flex-end', height: barHeight + 18 }}>
        {w.days.map((d, i) => (
          <FlexWidget key={`d${i}`} style={{ flex: 1, flexDirection: 'column', alignItems: 'center', flexGap: 3 }}>
            <FlexWidget
              style={{
                width: 'match_parent',
                height: Math.max(4, Math.round((Math.min(d.minutes, w.max) / w.max) * barHeight)),
                borderRadius: 4,
                backgroundColor: d.today ? theme.primary : d.minutes > 0 ? theme.success : theme.primarySoft,
              }}
            />
            <TextWidget text={d.label} style={{ fontSize: 10, color: d.today ? theme.text : theme.muted }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      <FlexWidget style={ROW}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={data.labels.weekTotal} style={{ fontSize: 12, color: theme.muted }} />
        </FlexWidget>
        <TextWidget text={w.total} style={{ fontSize: 14, fontWeight: 'bold', color: theme.text }} />
      </FlexWidget>
    </Card>
  );
}

export function SubjectWidget({ data, theme, subjectId }: Props & { subjectId?: string | null }) {
  const subject = data.subjects.find((s) => s.id === subjectId) ?? data.subjects[0];
  if (!subject) {
    return (
      <Card data={data} theme={theme}>
        <TextWidget text={data.labels.subjectNone} style={{ fontSize: 13, color: theme.muted }} />
      </Card>
    );
  }
  return (
    <Card data={data} theme={theme}>
      <FlexWidget style={ROW}>
        <FlexWidget style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subject.color as `#${string}` }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={subject.name} maxLines={1} truncate="END" style={{ fontSize: 16, fontWeight: 'bold', color: theme.text }} />
        </FlexWidget>
        {subject.average ? (
          <TextWidget text={`${subject.average}/20`} style={{ fontSize: 13, fontWeight: 'bold', color: theme.success }} />
        ) : null}
      </FlexWidget>
      <TextWidget
        text={data.labels.nextCourse.toUpperCase()}
        style={{ fontSize: 11, fontWeight: 'bold', color: theme.primary, letterSpacing: 0.5 }}
      />
      <TextWidget
        text={
          subject.nextCourse
            ? `${subject.nextCourse}${subject.nextCourseRoom ? `  ·  ${subject.nextCourseRoom}` : ''}`
            : data.labels.noCourse
        }
        style={{ fontSize: 14, fontWeight: '600', color: theme.text }}
      />
      <TextWidget
        text={subject.nextDue || data.labels.noTask}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: subject.openTasks > 0 ? theme.text : theme.muted }}
      />
      {subject.nextExam ? (
        <TextWidget text={`${data.labels.exams} · ${subject.nextExam}`} style={{ fontSize: 12, color: theme.danger }} />
      ) : null}
    </Card>
  );
}

export function ExamsWidget({ data, theme }: Props) {
  return (
    <Card data={data} theme={theme} url={data.links.tasks}>
      <TextWidget
        text={data.labels.exams.toUpperCase()}
        style={{ fontSize: 11, fontWeight: 'bold', color: theme.danger, letterSpacing: 0.5 }}
      />
      {data.upcomingExams.length === 0 ? (
        <TextWidget text={data.labels.noExam} style={{ fontSize: 14, color: theme.muted }} />
      ) : null}
      {data.upcomingExams.slice(0, 3).map((e, i) => (
        <FlexWidget key={`e${i}`} style={ROW}>
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget text={e.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: '600', color: theme.text }} />
            <TextWidget
              text={e.title === e.subject ? e.date : `${e.subject} · ${e.date}`}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 11, color: theme.muted }}
            />
          </FlexWidget>
          <TextWidget text={e.when} style={{ fontSize: 13, fontWeight: 'bold', color: i === 0 ? theme.danger : theme.primary }} />
        </FlexWidget>
      ))}
    </Card>
  );
}

export function QuickAddWidget({ data, theme }: Props) {
  const buttons = [
    { label: data.labels.quickNote, icon: '✎', url: data.links.note },
    { label: data.labels.quickTask, icon: '✓', url: data.links.task },
    { label: data.labels.quickAssignment, icon: '▤', url: data.links.assignment },
  ];
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: theme.surface,
        borderRadius: 20,
        padding: 10,
        flexDirection: 'row',
        flexGap: 8,
      }}
    >
      {buttons.map((b, i) => (
        <FlexWidget
          key={`b${i}`}
          {...CLICK}
          clickActionData={{ uri: b.url }}
          style={{
            flex: 1,
            height: 'match_parent',
            backgroundColor: theme.primarySoft,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            flexGap: 6,
          }}
        >
          <TextWidget text={b.icon} style={{ fontSize: 22, color: theme.primary }} />
          <TextWidget text={b.label} style={{ fontSize: 12, fontWeight: '600', color: theme.text }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}

export function GradesWidget({ data, theme }: Props) {
  const g = data.grades;
  return (
    <Card data={data} theme={theme} url={data.links.grades}>
      <TextWidget
        text={data.labels.overall.toUpperCase()}
        style={{ fontSize: 11, fontWeight: 'bold', color: theme.success, letterSpacing: 0.5 }}
      />
      <TextWidget text={g.overall ? `${g.overall}/20` : '—'} style={{ fontSize: 32, fontWeight: 'bold', color: theme.text }} />
      <TextWidget
        text={g.last ? `${data.labels.lastGrade} : ${g.last.value}/20 · ${g.last.title}` : data.labels.noGrade}
        maxLines={1}
        truncate="END"
        style={{ fontSize: 12, color: theme.muted }}
      />
      {g.subjects.slice(0, 3).map((s, i) => (
        <FlexWidget key={`s${i}`} style={ROW}>
          <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color as `#${string}` }} />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={s.name} maxLines={1} truncate="END" style={{ fontSize: 13, color: theme.text }} />
          </FlexWidget>
          <TextWidget text={`${s.average}/20`} style={{ fontSize: 13, fontWeight: '600', color: theme.text }} />
        </FlexWidget>
      ))}
    </Card>
  );
}

export function MonthWidget({ data, theme }: Props) {
  const m = data.month;
  const rows = [0, 1, 2, 3, 4, 5].map((r) => m.cells.slice(r * 7, r * 7 + 7));
  return (
    <Card data={data} theme={theme} url={data.links.calendar}>
      <Header title={m.title} right={data.next ? `${data.next.start} · ${data.next.title}` : ''} theme={theme} />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        {m.weekdays.map((d, i) => (
          <FlexWidget key={`w${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget text={d} style={{ fontSize: 9, fontWeight: '600', color: theme.muted }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      {rows.map((row, r) => (
        <FlexWidget key={`r${r}`} style={{ width: 'match_parent', flexDirection: 'row' }}>
          {row.map((c, i) => (
            <FlexWidget key={`c${i}`} style={{ flex: 1, alignItems: 'center', flexDirection: 'column', flexGap: 1 }}>
              <FlexWidget
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.today ? theme.primary : theme.surface,
                }}
              >
                <TextWidget
                  text={String(c.day)}
                  style={{
                    fontSize: 12,
                    fontWeight: c.today ? 'bold' : 'normal',
                    color: c.today ? theme.surface : c.inMonth ? theme.text : theme.muted,
                  }}
                />
              </FlexWidget>
              <FlexWidget style={{ flexDirection: 'row', flexGap: 2, height: 4 }}>
                {c.course ? <FlexWidget style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary }} /> : null}
                {c.due ? <FlexWidget style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.success }} /> : null}
                {c.exam ? <FlexWidget style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.danger }} /> : null}
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      ))}
    </Card>
  );
}

export function HabitsWidget({ data, theme }: Props) {
  const done = data.habits.filter((h) => h.done).length;
  return (
    <Card data={data} theme={theme} url={data.links.habits}>
      <Header title={data.labels.habits} right={`${done}/${data.habits.length}`} theme={theme} />
      {data.habits.length === 0 ? (
        <TextWidget text={data.labels.noHabit} style={{ fontSize: 13, color: theme.muted }} />
      ) : null}
      {data.habits.slice(0, 6).map((h, i) => (
        <FlexWidget key={`h${i}`} style={ROW}>
          <FlexWidget
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: h.done ? theme.success : (h.color as `#${string}`),
            }}
          />
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget
              text={h.name}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 14, color: h.done ? theme.muted : theme.text }}
            />
          </FlexWidget>
          <TextWidget
            text={h.done ? '✓' : h.progress}
            style={{ fontSize: 12, color: h.done ? theme.success : theme.muted }}
          />
        </FlexWidget>
      ))}
    </Card>
  );
}

const WIDGETS: Record<AndroidWidgetName, (p: Props & { subjectId?: string | null }) => React.JSX.Element> = {
  NextCourse: NextCourseWidget,
  Today: TodayWidget,
  Tasks: TasksWidget,
  Study: StudyWidget,
  Week: WeekWidget,
  Subject: SubjectWidget,
  Exams: ExamsWidget,
  QuickAdd: QuickAddWidget,
  Grades: GradesWidget,
  Month: MonthWidget,
  Habits: HabitsWidget,
};

export function renderAndroidWidget(
  name: AndroidWidgetName,
  data: WidgetData,
  options: { subjectId?: string | null } = {},
) {
  const Widget = WIDGETS[name];
  return {
    light: <Widget data={data} theme={asAndroidTheme(data.light)} subjectId={options.subjectId} />,
    dark: <Widget data={data} theme={asAndroidTheme(data.dark)} subjectId={options.subjectId} />,
  };
}
