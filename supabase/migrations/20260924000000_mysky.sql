-- MySky : schéma du serveur (Supabase). FICHIER GÉNÉRÉ, ne pas modifier à la main :
-- UPDATE_SERVER_SCHEMA=1 npx jest serverSchema  (voir src/modules/platform/sync/serverSchema.ts)

create or replace function public.mysky_touch() returns trigger language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

create table if not exists public.profiles (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  first_name text not null default '',
  last_name text not null default '',
  photo_path text,
  university text,
  field text,
  level text,
  academic_year text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.profiles
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists photo_path text,
  add column if not exists university text,
  add column if not exists field text,
  add column if not exists level text,
  add column if not exists academic_year text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists profiles_sync_idx on public.profiles (user_id, server_updated_at);
alter table public.profiles enable row level security;
drop policy if exists "own rows" on public.profiles;
create policy "own rows" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.profiles to authenticated;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.mysky_touch();

create table if not exists public.subjects (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  code text,
  teacher text,
  room text,
  color_id text not null,
  semester text,
  description text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.subjects
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists code text,
  add column if not exists teacher text,
  add column if not exists room text,
  add column if not exists color_id text not null,
  add column if not exists semester text,
  add column if not exists description text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists subjects_sync_idx on public.subjects (user_id, server_updated_at);
alter table public.subjects enable row level security;
drop policy if exists "own rows" on public.subjects;
create policy "own rows" on public.subjects for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.subjects to authenticated;
drop trigger if exists subjects_touch on public.subjects;
create trigger subjects_touch before insert or update on public.subjects
  for each row execute function public.mysky_touch();

create table if not exists public.timetables (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  valid_from text not null,
  valid_until text not null,
  kind text not null default 'courses',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.timetables
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists valid_from text not null,
  add column if not exists valid_until text not null,
  add column if not exists kind text not null default 'courses',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists timetables_sync_idx on public.timetables (user_id, server_updated_at);
alter table public.timetables enable row level security;
drop policy if exists "own rows" on public.timetables;
create policy "own rows" on public.timetables for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.timetables to authenticated;
drop trigger if exists timetables_touch on public.timetables;
create trigger timetables_touch before insert or update on public.timetables
  for each row execute function public.mysky_touch();

create table if not exists public.course_series (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  subject_id text not null,
  timetable_id text,
  title text,
  teacher text,
  room text,
  course_type text not null,
  weekday bigint not null,
  start_time text not null,
  end_time text not null,
  valid_from text not null,
  valid_until text not null,
  recurrence text not null,
  description text,
  reminder_minutes bigint,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.course_series
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists subject_id text not null,
  add column if not exists timetable_id text,
  add column if not exists title text,
  add column if not exists teacher text,
  add column if not exists room text,
  add column if not exists course_type text not null,
  add column if not exists weekday bigint not null,
  add column if not exists start_time text not null,
  add column if not exists end_time text not null,
  add column if not exists valid_from text not null,
  add column if not exists valid_until text not null,
  add column if not exists recurrence text not null,
  add column if not exists description text,
  add column if not exists reminder_minutes bigint,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists course_series_sync_idx on public.course_series (user_id, server_updated_at);
alter table public.course_series enable row level security;
drop policy if exists "own rows" on public.course_series;
create policy "own rows" on public.course_series for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.course_series to authenticated;
drop trigger if exists course_series_touch on public.course_series;
create trigger course_series_touch before insert or update on public.course_series
  for each row execute function public.mysky_touch();

create table if not exists public.course_exceptions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  series_id text not null,
  date text not null,
  kind text not null,
  new_start_time text,
  new_end_time text,
  new_room text,
  new_teacher text,
  new_title text,
  note text,
  new_date text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.course_exceptions
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists series_id text not null,
  add column if not exists date text not null,
  add column if not exists kind text not null,
  add column if not exists new_start_time text,
  add column if not exists new_end_time text,
  add column if not exists new_room text,
  add column if not exists new_teacher text,
  add column if not exists new_title text,
  add column if not exists note text,
  add column if not exists new_date text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists course_exceptions_sync_idx on public.course_exceptions (user_id, server_updated_at);
alter table public.course_exceptions enable row level security;
drop policy if exists "own rows" on public.course_exceptions;
create policy "own rows" on public.course_exceptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.course_exceptions to authenticated;
drop trigger if exists course_exceptions_touch on public.course_exceptions;
create trigger course_exceptions_touch before insert or update on public.course_exceptions
  for each row execute function public.mysky_touch();

create table if not exists public.off_periods (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  kind text not null,
  start_date text not null,
  end_date text not null,
  suspend_courses bigint not null default 1,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.off_periods
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists kind text not null,
  add column if not exists start_date text not null,
  add column if not exists end_date text not null,
  add column if not exists suspend_courses bigint not null default 1,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists off_periods_sync_idx on public.off_periods (user_id, server_updated_at);
alter table public.off_periods enable row level security;
drop policy if exists "own rows" on public.off_periods;
create policy "own rows" on public.off_periods for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.off_periods to authenticated;
drop trigger if exists off_periods_touch on public.off_periods;
create trigger off_periods_touch before insert or update on public.off_periods
  for each row execute function public.mysky_touch();

create table if not exists public.exams (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  subject_id text not null,
  title text,
  date text not null,
  time text,
  duration_minutes bigint,
  room text,
  description text,
  reminder_days text not null default '[]',
  reminder_time text not null default '09:00',
  grade double precision,
  grade_max double precision not null default 20,
  coefficient double precision not null default 1,
  timetable_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.exams
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists subject_id text not null,
  add column if not exists title text,
  add column if not exists date text not null,
  add column if not exists time text,
  add column if not exists duration_minutes bigint,
  add column if not exists room text,
  add column if not exists description text,
  add column if not exists reminder_days text not null default '[]',
  add column if not exists reminder_time text not null default '09:00',
  add column if not exists grade double precision,
  add column if not exists grade_max double precision not null default 20,
  add column if not exists coefficient double precision not null default 1,
  add column if not exists timetable_id text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists exams_sync_idx on public.exams (user_id, server_updated_at);
alter table public.exams enable row level security;
drop policy if exists "own rows" on public.exams;
create policy "own rows" on public.exams for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.exams to authenticated;
drop trigger if exists exams_touch on public.exams;
create trigger exams_touch before insert or update on public.exams
  for each row execute function public.mysky_touch();

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  title text not null,
  description text,
  subject_id text,
  due_date text not null,
  due_time text,
  priority text not null,
  status text not null,
  completed_at text,
  reminder_at text,
  repeat_rule text not null default 'none',
  estimated_minutes bigint,
  space text not null default 'personal',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.tasks
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists title text not null,
  add column if not exists description text,
  add column if not exists subject_id text,
  add column if not exists due_date text not null,
  add column if not exists due_time text,
  add column if not exists priority text not null,
  add column if not exists status text not null,
  add column if not exists completed_at text,
  add column if not exists reminder_at text,
  add column if not exists repeat_rule text not null default 'none',
  add column if not exists estimated_minutes bigint,
  add column if not exists space text not null default 'personal',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists tasks_sync_idx on public.tasks (user_id, server_updated_at);
alter table public.tasks enable row level security;
drop policy if exists "own rows" on public.tasks;
create policy "own rows" on public.tasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.tasks to authenticated;
drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.mysky_touch();

create table if not exists public.assignments (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  title text not null,
  description text,
  subject_id text,
  due_date text not null,
  due_time text,
  priority text not null,
  status text not null,
  completed_at text,
  reminder_at text,
  repeat_rule text not null default 'none',
  estimated_minutes bigint,
  space text not null default 'study',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.assignments
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists title text not null,
  add column if not exists description text,
  add column if not exists subject_id text,
  add column if not exists due_date text not null,
  add column if not exists due_time text,
  add column if not exists priority text not null,
  add column if not exists status text not null,
  add column if not exists completed_at text,
  add column if not exists reminder_at text,
  add column if not exists repeat_rule text not null default 'none',
  add column if not exists estimated_minutes bigint,
  add column if not exists space text not null default 'study',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists assignments_sync_idx on public.assignments (user_id, server_updated_at);
alter table public.assignments enable row level security;
drop policy if exists "own rows" on public.assignments;
create policy "own rows" on public.assignments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.assignments to authenticated;
drop trigger if exists assignments_touch on public.assignments;
create trigger assignments_touch before insert or update on public.assignments
  for each row execute function public.mysky_touch();

create table if not exists public.personal_events (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  title text not null,
  date text not null,
  start_time text,
  end_time text,
  description text,
  reminder_at text,
  space text not null default 'personal',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.personal_events
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists title text not null,
  add column if not exists date text not null,
  add column if not exists start_time text,
  add column if not exists end_time text,
  add column if not exists description text,
  add column if not exists reminder_at text,
  add column if not exists space text not null default 'personal',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists personal_events_sync_idx on public.personal_events (user_id, server_updated_at);
alter table public.personal_events enable row level security;
drop policy if exists "own rows" on public.personal_events;
create policy "own rows" on public.personal_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.personal_events to authenticated;
drop trigger if exists personal_events_touch on public.personal_events;
create trigger personal_events_touch before insert or update on public.personal_events
  for each row execute function public.mysky_touch();

create table if not exists public.note_categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  color_id text not null default 'slate',
  position bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.note_categories
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists color_id text not null default 'slate',
  add column if not exists position bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists note_categories_sync_idx on public.note_categories (user_id, server_updated_at);
alter table public.note_categories enable row level security;
drop policy if exists "own rows" on public.note_categories;
create policy "own rows" on public.note_categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.note_categories to authenticated;
drop trigger if exists note_categories_touch on public.note_categories;
create trigger note_categories_touch before insert or update on public.note_categories
  for each row execute function public.mysky_touch();

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  title text not null,
  content text not null default '',
  subject_id text,
  course_series_id text,
  course_date text,
  is_favorite bigint not null default 0,
  space text not null default 'personal',
  category_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.notes
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists title text not null,
  add column if not exists content text not null default '',
  add column if not exists subject_id text,
  add column if not exists course_series_id text,
  add column if not exists course_date text,
  add column if not exists is_favorite bigint not null default 0,
  add column if not exists space text not null default 'personal',
  add column if not exists category_id text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists notes_sync_idx on public.notes (user_id, server_updated_at);
alter table public.notes enable row level security;
drop policy if exists "own rows" on public.notes;
create policy "own rows" on public.notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notes to authenticated;
drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before insert or update on public.notes
  for each row execute function public.mysky_touch();

create table if not exists public.attachments (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  note_id text not null,
  kind text not null,
  name text not null,
  mime_type text,
  size bigint,
  local_path text not null,
  remote_path text,
  upload_status text not null default 'pending',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.attachments
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists note_id text not null,
  add column if not exists kind text not null,
  add column if not exists name text not null,
  add column if not exists mime_type text,
  add column if not exists size bigint,
  add column if not exists local_path text not null,
  add column if not exists remote_path text,
  add column if not exists upload_status text not null default 'pending',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists attachments_sync_idx on public.attachments (user_id, server_updated_at);
alter table public.attachments enable row level security;
drop policy if exists "own rows" on public.attachments;
create policy "own rows" on public.attachments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.attachments to authenticated;
drop trigger if exists attachments_touch on public.attachments;
create trigger attachments_touch before insert or update on public.attachments
  for each row execute function public.mysky_touch();

create table if not exists public.study_sessions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  subject_id text,
  started_at text not null,
  ended_at text,
  planned_minutes bigint not null,
  kind text not null default 'focus',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.study_sessions
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists subject_id text,
  add column if not exists started_at text not null,
  add column if not exists ended_at text,
  add column if not exists planned_minutes bigint not null,
  add column if not exists kind text not null default 'focus',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists study_sessions_sync_idx on public.study_sessions (user_id, server_updated_at);
alter table public.study_sessions enable row level security;
drop policy if exists "own rows" on public.study_sessions;
create policy "own rows" on public.study_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.study_sessions to authenticated;
drop trigger if exists study_sessions_touch on public.study_sessions;
create trigger study_sessions_touch before insert or update on public.study_sessions
  for each row execute function public.mysky_touch();

create table if not exists public.habits (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  icon text not null default 'check-circle',
  color_id text not null default 'blue',
  frequency text not null default 'daily',
  weekdays text not null default '[]',
  times_per_week bigint not null default 1,
  target bigint not null default 1,
  unit text,
  reminder_time text,
  auto_study bigint not null default 0,
  position bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.habits
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists icon text not null default 'check-circle',
  add column if not exists color_id text not null default 'blue',
  add column if not exists frequency text not null default 'daily',
  add column if not exists weekdays text not null default '[]',
  add column if not exists times_per_week bigint not null default 1,
  add column if not exists target bigint not null default 1,
  add column if not exists unit text,
  add column if not exists reminder_time text,
  add column if not exists auto_study bigint not null default 0,
  add column if not exists position bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists habits_sync_idx on public.habits (user_id, server_updated_at);
alter table public.habits enable row level security;
drop policy if exists "own rows" on public.habits;
create policy "own rows" on public.habits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.habits to authenticated;
drop trigger if exists habits_touch on public.habits;
create trigger habits_touch before insert or update on public.habits
  for each row execute function public.mysky_touch();

create table if not exists public.habit_logs (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  habit_id text not null,
  date text not null,
  count bigint not null default 0,
  status text not null default 'done',
  reason_code text,
  reason text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.habit_logs
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists habit_id text not null,
  add column if not exists date text not null,
  add column if not exists count bigint not null default 0,
  add column if not exists status text not null default 'done',
  add column if not exists reason_code text,
  add column if not exists reason text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists habit_logs_sync_idx on public.habit_logs (user_id, server_updated_at);
alter table public.habit_logs enable row level security;
drop policy if exists "own rows" on public.habit_logs;
create policy "own rows" on public.habit_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.habit_logs to authenticated;
drop trigger if exists habit_logs_touch on public.habit_logs;
create trigger habit_logs_touch before insert or update on public.habit_logs
  for each row execute function public.mysky_touch();

create table if not exists public.work_subtasks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  work_kind text not null,
  work_id text not null,
  title text not null,
  done bigint not null default 0,
  position bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.work_subtasks
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists work_kind text not null,
  add column if not exists work_id text not null,
  add column if not exists title text not null,
  add column if not exists done bigint not null default 0,
  add column if not exists position bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists work_subtasks_sync_idx on public.work_subtasks (user_id, server_updated_at);
alter table public.work_subtasks enable row level security;
drop policy if exists "own rows" on public.work_subtasks;
create policy "own rows" on public.work_subtasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.work_subtasks to authenticated;
drop trigger if exists work_subtasks_touch on public.work_subtasks;
create trigger work_subtasks_touch before insert or update on public.work_subtasks
  for each row execute function public.mysky_touch();

create table if not exists public.revision_blocks (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  subject_id text,
  exam_id text,
  timetable_id text,
  date text not null,
  start_time text not null,
  end_time text not null,
  title text,
  status text not null default 'planned',
  study_session_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.revision_blocks
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists subject_id text,
  add column if not exists exam_id text,
  add column if not exists timetable_id text,
  add column if not exists date text not null,
  add column if not exists start_time text not null,
  add column if not exists end_time text not null,
  add column if not exists title text,
  add column if not exists status text not null default 'planned',
  add column if not exists study_session_id text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists revision_blocks_sync_idx on public.revision_blocks (user_id, server_updated_at);
alter table public.revision_blocks enable row level security;
drop policy if exists "own rows" on public.revision_blocks;
create policy "own rows" on public.revision_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.revision_blocks to authenticated;
drop trigger if exists revision_blocks_touch on public.revision_blocks;
create trigger revision_blocks_touch before insert or update on public.revision_blocks
  for each row execute function public.mysky_touch();

create table if not exists public.mood_logs (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  date text not null,
  mood bigint not null,
  energy bigint not null,
  note text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.mood_logs
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists date text not null,
  add column if not exists mood bigint not null,
  add column if not exists energy bigint not null,
  add column if not exists note text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists mood_logs_sync_idx on public.mood_logs (user_id, server_updated_at);
alter table public.mood_logs enable row level security;
drop policy if exists "own rows" on public.mood_logs;
create policy "own rows" on public.mood_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.mood_logs to authenticated;
drop trigger if exists mood_logs_touch on public.mood_logs;
create trigger mood_logs_touch before insert or update on public.mood_logs
  for each row execute function public.mysky_touch();

create table if not exists public.money_categories (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  kind text not null,
  name text not null,
  icon text not null default 'tag',
  color_id text not null default 'slate',
  position bigint not null default 0,
  archived bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.money_categories
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists kind text not null,
  add column if not exists name text not null,
  add column if not exists icon text not null default 'tag',
  add column if not exists color_id text not null default 'slate',
  add column if not exists position bigint not null default 0,
  add column if not exists archived bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists money_categories_sync_idx on public.money_categories (user_id, server_updated_at);
alter table public.money_categories enable row level security;
drop policy if exists "own rows" on public.money_categories;
create policy "own rows" on public.money_categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.money_categories to authenticated;
drop trigger if exists money_categories_touch on public.money_categories;
create trigger money_categories_touch before insert or update on public.money_categories
  for each row execute function public.mysky_touch();

create table if not exists public.money_goals (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  name text not null,
  target_minor bigint not null,
  currency text not null,
  deadline text,
  archived bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.money_goals
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists name text not null,
  add column if not exists target_minor bigint not null,
  add column if not exists currency text not null,
  add column if not exists deadline text,
  add column if not exists archived bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists money_goals_sync_idx on public.money_goals (user_id, server_updated_at);
alter table public.money_goals enable row level security;
drop policy if exists "own rows" on public.money_goals;
create policy "own rows" on public.money_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.money_goals to authenticated;
drop trigger if exists money_goals_touch on public.money_goals;
create trigger money_goals_touch before insert or update on public.money_goals
  for each row execute function public.mysky_touch();

create table if not exists public.money_loans (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  direction text not null,
  person text not null,
  due_date text,
  note text,
  closed bigint not null default 0,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.money_loans
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists direction text not null,
  add column if not exists person text not null,
  add column if not exists due_date text,
  add column if not exists note text,
  add column if not exists closed bigint not null default 0,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists money_loans_sync_idx on public.money_loans (user_id, server_updated_at);
alter table public.money_loans enable row level security;
drop policy if exists "own rows" on public.money_loans;
create policy "own rows" on public.money_loans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.money_loans to authenticated;
drop trigger if exists money_loans_touch on public.money_loans;
create trigger money_loans_touch before insert or update on public.money_loans
  for each row execute function public.mysky_touch();

create table if not exists public.money_recurring (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  kind text not null,
  name text not null,
  category_id text,
  amount_minor bigint not null,
  currency text not null,
  frequency text not null,
  day_of_month bigint not null default 1,
  weekday bigint not null default 6,
  time text,
  reminders text not null default '[]',
  start_date text not null,
  end_date text,
  active bigint not null default 1,
  payout_date text,
  payout_minor bigint,
  payout_auto bigint not null default 1,
  payout_recorded bigint not null default 0,
  note text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.money_recurring
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists kind text not null,
  add column if not exists name text not null,
  add column if not exists category_id text,
  add column if not exists amount_minor bigint not null,
  add column if not exists currency text not null,
  add column if not exists frequency text not null,
  add column if not exists day_of_month bigint not null default 1,
  add column if not exists weekday bigint not null default 6,
  add column if not exists time text,
  add column if not exists reminders text not null default '[]',
  add column if not exists start_date text not null,
  add column if not exists end_date text,
  add column if not exists active bigint not null default 1,
  add column if not exists payout_date text,
  add column if not exists payout_minor bigint,
  add column if not exists payout_auto bigint not null default 1,
  add column if not exists payout_recorded bigint not null default 0,
  add column if not exists note text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists money_recurring_sync_idx on public.money_recurring (user_id, server_updated_at);
alter table public.money_recurring enable row level security;
drop policy if exists "own rows" on public.money_recurring;
create policy "own rows" on public.money_recurring for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.money_recurring to authenticated;
drop trigger if exists money_recurring_touch on public.money_recurring;
create trigger money_recurring_touch before insert or update on public.money_recurring
  for each row execute function public.mysky_touch();

create table if not exists public.money_transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  kind text not null,
  amount_minor bigint not null,
  currency text not null,
  category_id text,
  date text not null,
  note text,
  recurring_id text,
  occurrence_date text,
  goal_id text,
  loan_id text,
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.money_transactions
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists kind text not null,
  add column if not exists amount_minor bigint not null,
  add column if not exists currency text not null,
  add column if not exists category_id text,
  add column if not exists date text not null,
  add column if not exists note text,
  add column if not exists recurring_id text,
  add column if not exists occurrence_date text,
  add column if not exists goal_id text,
  add column if not exists loan_id text,
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists money_transactions_sync_idx on public.money_transactions (user_id, server_updated_at);
alter table public.money_transactions enable row level security;
drop policy if exists "own rows" on public.money_transactions;
create policy "own rows" on public.money_transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.money_transactions to authenticated;
drop trigger if exists money_transactions_touch on public.money_transactions;
create trigger money_transactions_touch before insert or update on public.money_transactions
  for each row execute function public.mysky_touch();

create table if not exists public.work_slots (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at text not null,
  updated_at text not null,
  deleted_at text,
  version bigint not null default 0,
  title text not null,
  weekdays text not null default '[]',
  start_time text not null,
  end_time text not null,
  location text,
  note text,
  rotation text not null default 'every',
  valid_from text not null,
  valid_until text,
  color_id text not null default 'blue',
  space text not null default 'work',
  server_updated_at timestamptz not null default clock_timestamp()
);
alter table public.work_slots
  add column if not exists user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  add column if not exists created_at text not null,
  add column if not exists updated_at text not null,
  add column if not exists deleted_at text,
  add column if not exists version bigint not null default 0,
  add column if not exists title text not null,
  add column if not exists weekdays text not null default '[]',
  add column if not exists start_time text not null,
  add column if not exists end_time text not null,
  add column if not exists location text,
  add column if not exists note text,
  add column if not exists rotation text not null default 'every',
  add column if not exists valid_from text not null,
  add column if not exists valid_until text,
  add column if not exists color_id text not null default 'blue',
  add column if not exists space text not null default 'work',
  add column if not exists server_updated_at timestamptz not null default clock_timestamp();
create index if not exists work_slots_sync_idx on public.work_slots (user_id, server_updated_at);
alter table public.work_slots enable row level security;
drop policy if exists "own rows" on public.work_slots;
create policy "own rows" on public.work_slots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.work_slots to authenticated;
drop trigger if exists work_slots_touch on public.work_slots;
create trigger work_slots_touch before insert or update on public.work_slots
  for each row execute function public.mysky_touch();

-- Modifications déjà appliquées (une même modification renvoyée après une coupure ne compte qu’une fois).
create table if not exists public.sync_mutations (
  mutation_id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity text not null,
  entity_id text not null,
  result_version bigint not null,
  applied_at timestamptz not null default now()
);
alter table public.sync_mutations enable row level security;
drop policy if exists "own rows" on public.sync_mutations;
create policy "own rows" on public.sync_mutations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert on public.sync_mutations to authenticated;

-- Applique une liste de modifications envoyées par le téléphone, dans l'ordre.
-- Résultat par modification : applied (avec la nouvelle version), conflict (avec la ligne du serveur) ou missing.
create or replace function public.mysky_push(p_mutations jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  m jsonb;
  results jsonb := '[]'::jsonb;
  v_mid text;
  v_table text;
  v_id text;
  v_op text;
  v_base bigint;
  v_payload jsonb;
  v_current bigint;
  v_prev bigint;
  v_cols text;
  v_vals text;
  v_sets text;
  v_new bigint;
  v_row jsonb;
  allowed text[] := array['profiles', 'subjects', 'timetables', 'course_series', 'course_exceptions', 'off_periods', 'exams', 'tasks', 'assignments', 'personal_events', 'note_categories', 'notes', 'attachments', 'study_sessions', 'habits', 'habit_logs', 'work_subtasks', 'revision_blocks', 'mood_logs', 'money_categories', 'money_goals', 'money_loans', 'money_recurring', 'money_transactions', 'work_slots'];
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  for m in select value from jsonb_array_elements(p_mutations) loop
    v_mid := m->>'mutation_id';
    v_table := m->>'entity';
    v_id := m->>'entity_id';
    v_op := m->>'operation';
    v_base := nullif(m->>'base_version', '')::bigint;
    v_payload := coalesce(m->'payload', '{}'::jsonb) - 'id' - 'user_id' - 'version' - 'server_updated_at' - 'sync_status';
    if v_table is null or not (v_table = any (allowed)) then
      raise exception 'unknown entity %', v_table using errcode = '22023';
    end if;

    select result_version into v_prev from sync_mutations where mutation_id = v_mid;
    if found then
      results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_prev));
      continue;
    end if;

    execute format('select version from public.%I where id = $1', v_table) into v_current using v_id;

    select string_agg(quote_ident(k), ', '),
           string_agg('r.' || quote_ident(k), ', '),
           string_agg(quote_ident(k) || ' = r.' || quote_ident(k), ', ')
      into v_cols, v_vals, v_sets
      from jsonb_object_keys(v_payload) as k
     where exists (
       select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = v_table and c.column_name = k
          and c.column_name not in ('id', 'user_id', 'version', 'server_updated_at'));

    if v_op = 'create' then
      if v_current is not null then
        v_new := v_current;
      else
        execute format(
          'insert into public.%I (id, version%s) select $1, 1%s from jsonb_populate_record(null::public.%I, $2) as r',
          v_table, coalesce(', ' || v_cols, ''), coalesce(', ' || v_vals, ''), v_table)
          using v_id, v_payload;
        v_new := 1;
      end if;
    else
      if v_current is null then
        results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'missing'));
        continue;
      end if;
      if v_base is distinct from v_current then
        execute format('select to_jsonb(t) - ''user_id'' from public.%I as t where id = $1', v_table) into v_row using v_id;
        results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'conflict', 'server', v_row));
        continue;
      end if;
      execute format(
        'update public.%I as t set %sversion = t.version + 1 from jsonb_populate_record(null::public.%I, $2) as r where t.id = $1',
        v_table, coalesce(v_sets || ', ', ''), v_table)
        using v_id, v_payload;
      v_new := v_current + 1;
    end if;

    insert into sync_mutations (mutation_id, entity, entity_id, result_version) values (v_mid, v_table, v_id, v_new);
    results := results || jsonb_build_array(jsonb_build_object('mutation_id', v_mid, 'status', 'applied', 'version', v_new));
  end loop;
  return results;
end $$;
revoke all on function public.mysky_push(jsonb) from public, anon;
grant execute on function public.mysky_push(jsonb) to authenticated;

insert into storage.buckets (id, name, public) values ('mysky-files', 'mysky-files', false)
  on conflict (id) do nothing;
drop policy if exists "mysky own files" on storage.objects;
create policy "mysky own files" on storage.objects for all to authenticated
  using (bucket_id = 'mysky-files' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mysky-files' and (storage.foldername(name))[1] = auth.uid()::text);
