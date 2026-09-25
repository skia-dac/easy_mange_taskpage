# Planning — MySky (student organisation app, Expo, Android + iOS)

Status: **planning phase**. Nothing below is implemented yet.
Reference documents:
- Features: MVP functional specification (to be stored as `docs/SPEC.md`).
- Architecture: *Architecture MVP — Application mobile d'organisation étudiante* (29 Aug 2026): **Mobile Offline-First + Backend Modular Monolith**. This plan applies it to a concrete stack. When they disagree, the architecture document wins.

---

## 1. Assessment of the spec

**Strong points**
- Clear product idea: *Aujourd'hui → Cours → Matière → Notes / Devoirs / Tâches / Examens*.
- Strict scope with an explicit exclusion list — very useful when implementing with an LLM.
- The right safety rules: never save imported data without validation, confirm destructive actions, never lose data silently.
- Recurring courses with a validity period and per-occurrence edits: this is how real university timetables work.

**Main risk: the MVP is large.** 19 modules and 28 screens. Four parts are much harder than the rest:

| Hard part | Why it is hard |
|---|---|
| Offline mode + sync (§84–87) | Needs a local database, a queue of pending changes, conflict handling and deletions that sync correctly. |
| Recurring courses with exceptions (§24–29, §42) | "This one / this and following / whole series" + cancellations + holidays = recurrence rules plus exceptions. |
| PDF/image import (§30–36) | Needs OCR or a vision model, per-field uncertainty, a preview that can be edited, and duplicate detection. |
| Notifications (§71–80) | iOS keeps at most **64 pending local notifications**. Weekly courses × 2 notifications (before + end) exceed this quickly, so notifications must be rescheduled in a rolling window. |

Recommendation: build it in phases (section 5), with a usable app at the end of each phase.

---

## 2. Spec issues to fix before implementation

1. **§4 Navigation — decided (product owner):**
   `Aujourd'hui` · `Calendrier` · `Notes` · `Tâches` · `Profil`
   - **Tâches** has three segments: Tâches · Devoirs · Examens.
   - **Matières** has no tab, but it stays central (spec §13, §101):
     - Every course, note, devoir and exam card opens its subject page.
     - Notes and Tâches have a row of subject chips to filter.
     - Profil has "Mes matières" (the list, and create/edit).
     - The Aujourd'hui quick-add can create a subject.
   - **Emploi du temps** (timetables, import, holidays) opens from the Calendrier header and from Profil.
   - A **"+" button** (note, tâche, devoir, examen, événement, cours) is on Aujourd'hui, Calendrier, Notes and Tâches. It pre-fills the context.
   - **Header:** search and notifications. Settings are in Profil.
2. **Apple Sign-In is required, not optional.** App Store guideline 4.8 requires Sign in with Apple when Google login is offered on iOS. §5.1 lists only Google. Add Apple to §5.1.
3. **Account deletion (§6)** is also required by the App Store. It must delete server data and attachments, not just log the user out.
4. **"Notes" is ambiguous in French** (course notes vs grades). The spec means *course notes*. State explicitly that grade tracking is out of scope.
5. **Import uses automatic analysis, but §3 excludes "IA".** Clarify that a vision model/OCR is allowed *only* for timetable extraction, with mandatory validation (rule 7).
6. **Import needs a connection.** Say that import is unavailable offline and show a clear message.
7. **Devoir vs Tâche** are very similar. The architecture keeps them as separate entities (`Assignment` ≠ `Task`), and we follow that. They can share UI components (list item, priority, status, "late" badge).
8. **Examen requires a matière (rule 6)** but the §97 journey could skip it. Enforce it in the form.
9. **Holidays (§42):** suspended occurrences are hidden when occurrences are calculated. Nothing is deleted, so removing the holiday brings them back. Cancelled occurrences (§29) stay visible with an "annulé" label.
10. **Time zones / DST:** store course times as local wall-clock time + the timetable's time zone, so a 09:00 course stays at 09:00 after a clock change.
11. **Conflict rule for sync:** the architecture document (§7.4) says a conflict must never silently overwrite recent user data. So each record has a `version`. The server rejects an update based on an old version, and the record moves to the `conflict` state (section 4). Deletions are soft deletes that sync (`deleted_at`), so they are never recreated by mistake.

---

## 3. Recommended stack

| Concern | Choice | Notes |
|---|---|---|
| App | **Expo (latest SDK) + TypeScript + Expo Router** | Dev builds (not Expo Go) are needed for Apple/Google sign-in and notifications. |
| Build / release | **EAS Build + EAS Submit** | Builds iOS without a Mac. |
| Backend | **Supabase** (Auth, Postgres + RLS, Storage, Edge Functions) | Email, Google and Apple auth built in. Storage for attachments and import files. How the modular monolith maps onto it: section 4. |
| Local DB | **expo-sqlite** + small in-house migration runner (`src/shared/db`) | The local DB is the source of truth for the UI. This gives offline mode directly. An ORM (Drizzle) can be added in phase 1 if queries become repetitive. |
| Sync | Custom sync engine: outbox push with a version check + pull by server cursor | Behaviour is defined in section 4.4. |
| State / queries | TanStack Query or Drizzle live queries + Zustand for UI state | |
| Forms | react-hook-form + zod | The same zod schemas validate forms and import rows. |
| Dates | date-fns + date-fns-tz, rrule for recurrence | |
| Calendar UI | `@howljs/calendar-kit` (day/week) + `react-native-calendars` (month/agenda) | |
| Rich notes | Light markup (`# titre`, `**gras**`, `_italique_`, `- liste`, `1. liste`, `[ ] case`) + toolbar, rendered natively | Works in Expo Go (no native editor needed), plain text is searchable and syncs as text. 10tap-editor can replace it later if a dev build is adopted. |
| Notifications | expo-notifications (local), with action buttons for end of course | Rolling scheduling window of about 60 notifications, refilled on app open and in background. |
| Files | expo-document-picker, expo-image-picker, expo-file-system | |
| Import analysis | `ai-import` Edge Function → vision LLM, returns strict JSON with per-field confidence | Produces an `ImportedTimetableDraft` only. It never creates `CourseSeries` (arch. §8). |
| Search | SQLite FTS5 on the local DB | Works offline, covers all entity types. |
| i18n | **French + English** (i18next + expo-localization). Follows the device language, with an override in settings | All texts in translation files from Phase 0. Dates formatted by locale |

---

## 4. Architecture applied to Expo + Supabase

### 4.1 Mobile layers (arch. §3)

```
UI (Expo Router screens, components)       → shows state, calls use cases, no business rules
Application (use cases)                    → CreateCourse, UpdateCourseOccurrence, GetTodayDashboard, ValidateImportedTimetable…
Domain (pure TypeScript, no Expo imports)  → entities, invariants, recurrence projection, "late" rule
Repositories (interfaces in domain)        → CourseRepository.getCoursesByDate()…
Infrastructure                             → SQLite/Drizzle implementation, sync engine, Supabase client, notification scheduler
```

The domain and use cases are plain TypeScript, so they can be unit-tested without a phone.

### 4.2 Folder structure (the domains of arch. §4, plus `finance` since 25 Sep 2026)

```
app/                          # Expo Router routes only (thin; they call modules/*/ui)
  (auth)/  (tabs)/today  (tabs)/calendar  (tabs)/notes  (tabs)/tasks  (tabs)/profile  subjects/  timetables/
src/modules/
  identity/      auth, profile, preferences
  academic/      subjects, timetables, course-series, course-exceptions, exams, holidays
  productivity/  notes, tasks, assignments, attachments
  platform/      notifications, files, ai-import, sync, search
    └─ each module: domain/ application/ infrastructure/ ui/ index.ts (public contract)
src/projections/ today-dashboard, calendar   # read-only aggregators, own no data (arch. §6.3, §10)
src/shared/      ui kit, db client, date utils, errors → user-friendly messages
supabase/
  migrations/    one schema per domain: identity, academic, productivity, platform
  functions/     sync, ai-import, delete-account
```

Module rule: code imports another module only through its `index.ts`. A lint rule (eslint `no-restricted-imports` / boundaries) enforces this and blocks circular imports.

### 4.3 Backend = modular monolith on Supabase

- **One Supabase project = one deployable backend.** The four domains are separate Postgres schemas with RLS (`user_id = auth.uid()` on every table).
- **The mobile app never writes tables directly.** All writes go through a single `sync` Edge Function, which applies mutations in a transaction and checks versions. Domain rules that must hold on the server (end time after start time, exam requires a subject and a date) are enforced there and by DB constraints.
- `ai-import` and `delete-account` are separate functions. These are the first candidates to extract later (arch. §12).

### 4.4 Sync engine (arch. §7, §11.1)

- Every row: `id` (UUID generated on the device), `created_at`, `updated_at`, `deleted_at`, `version`, plus a local-only `sync_status` (`synced | pending_create | pending_update | pending_delete | conflict`).
- Every user action: save locally → UI updates immediately → a mutation goes into the outbox with a unique `mutation_id`.
- **Push:** the server stores applied `mutation_id`s, so a mutation replayed after a network cut is applied only once (idempotence). If the base `version` is older than the server's version, the server rejects it and the local row becomes `conflict`.
- **Pull:** the client downloads changes after its last server cursor.
- **Conflicts:** a simple screen shows "this device" vs "other device" for that item, and the user picks. For notes, "keep both" makes a copy. Nothing is overwritten silently.
- **Retry:** automatic with backoff when the network comes back or the app returns to the foreground, plus a manual "Réessayer" button. A banner appears only for problems that persist.

### 4.5 Entities (arch. §5)

- **identity:** `profiles`, `notification_preferences`
- **academic:** `subjects`, `timetables` (name, valid_from, valid_until, timezone)
  - `course_series`: subject, teacher, room, weekday, start_time, end_time, valid_from, valid_until, type, recurrence (`none` | `weekly`)
  - `course_exceptions`: series_id, date, type `CANCELLED | MODIFIED`, new_start_time?, new_end_time?, new_room?, new_teacher?
  - `exams` (subject_id and date required), `holidays` (period or single day, suspend_courses)
- **productivity:**
  - `notes`: content_json + content_text, subject?, occurrence (series_id + date)?, favorite
  - `tasks`: subject optional
  - `assignments`: subject, due date, priority, status, completed_at
  - `attachments`
- **productivity (implemented there in phase 1):** `personal_events`
- **platform:** `import_jobs`, `imported_timetable_drafts` (rows with a confidence value or a "à vérifier" flag), `mutations_applied`

Edit options on a recurring course:
- "This occurrence only" → a `MODIFIED` exception.
- "This and following" → end the series the day before, and create a new series from that date.
- "Whole series" → update the series.

Occurrences, the calendar, the Today dashboard and "late" status are **computed**, never stored.
Holidays hide occurrences during the calculation, and they reappear if the holiday is removed.

### 4.6 Notifications (arch. §9)

A `ReminderScheduler` in `platform/notifications` watches domain changes (create, update, cancel, delete). It recomputes the next ~60 local notifications from the projections. It runs on every relevant change, on app start, and from a background task. End-of-course notifications use a notification category with the actions *Ajouter un devoir / une note / une tâche / Rien à ajouter*. Each action opens the form with the subject pre-filled.

## 5. Phased delivery

| Phase | Content | Result |
|---|---|---|
| **0. Setup** ✅ done | ~~Remove the old Flutter code~~ (done), create the Expo project with the module structure + boundary lint, tests, CI, EAS, design tokens, i18n, local DB (Supabase project moved to phase 2) | Empty app runs on both platforms |
| **1. Local core (offline by design)** ✅ done | Subjects, timetables, course series (weekly), calendar + Today projections, tasks/assignments/exams/events, confirmations, empty states. Sync metadata columns and the outbox already written, but no server yet | Fully usable app on one device, no account |
| **2. Accounts + sync** ✅ built (needs a Supabase project to go live, see §5g) | Email/Google/Apple auth, profile, onboarding, Supabase schemas + RLS, `sync` function (versions, idempotence), conflict screen, retry, account deletion | Data restored on a new device |
| **3. Notifications** ✅ done | Course/homework/task/exam reminders, end-of-course actions with prefilled forms, settings, rolling scheduler | Acceptance criteria 17–19 |
| **4. Advanced timetable** ✅ done (before 2 and 3: no server needed) | Per-occurrence edits (3 options), cancellations, holidays/days off with suspension | Criteria 6, rule 8 |
| **5. Notes** ✅ done (light markup editor, Expo Go compatible; rich editor deferred) | Rich editor, attachments (offline queue), favorites, "take notes" from a course | Criteria 9–10 |
| **6. Import** | Pick PDF/image → Edge Function → editable preview with uncertain-field flags → duplicate check → create subjects + courses | Criteria 7, 8, 23, 24 |
| **7. Search + polish** ◐ search + onboarding done; polish/store assets pending | Global FTS search, error messages, accessibility, store assets, TestFlight / Play internal testing | Launch candidate |

Phase 1 comes before auth on purpose. Building local-first from the start is what makes offline mode reliable. Adding it at the end rarely works.

---

## 5b. Design direction (inspiration: Dribbble "task management mobile app")

Reviewed the popular shots of the search (Ronas IT, Pixelean, Orenji Studio, Keitoto, Fireart…). These are inspiration only. We do not copy any design.

**Patterns we keep**
- Header with a greeting + the date ("Bonjour Awa · mardi 23 sept.").
- **Horizontal week strip** (L M M J V S D) at the top of Aujourd'hui and Calendrier.
- One **highlighted card** for the most important item: *Prochain cours* / *Cours en cours*.
- Large rounded cards (radius 20–24), lots of white space, short labels.
- **The subject colour is the main visual code:** a coloured bar or light tint on every course, note, devoir and exam card. This makes "the subject as the central element" visible.
- Chips for filters (subject, status) and segments (Tâches · Devoirs · Examens).
- Floating, pill-shaped bottom bar with 5 icons + labels.
- Bottom sheet for quick add (+).

**Patterns we avoid**
- Charts, stats and progress dashboards (out of MVP scope).
- Avatars of team members (no collaboration in the MVP).
- Glassmorphism and heavy gradients (hard to read, slow on low-end Android).

**MySky visual base (to refine in Phase 0)**
- Primary colour: sky blue. Neutral light background, and **dark mode** from the start.
- Subject palette: about 12 soft colours that the student picks for each subject.
- Status colours: late = red, today = orange, done = green/grey.
- Typography: one sans-serif family (e.g. Inter or Plus Jakarta Sans). Titles 24–28, body 15–16.
- Accessibility: contrast AA, touch targets ≥ 44 pt, dynamic font size respected.

**Mock-ups (validated direction):** https://claude.ai/artifact/BXWQxZyRPWzu9KNHhb2n5K
- Discovery flow (implemented without the account steps, which come with phase 2): Splash → 3 intro screens (what MySky does, photo import, reminders) → sign-up (Apple / Google / email) → "Comment veux-tu commencer ?"
- 38 screens covering every screen of spec §98: account (sign-in, forgotten password), 5 tabs + empty state, subjects (list, detail, form, delete with the choice of keeping linked content), timetable (list, course form, edit a repeated course with 3 options, holidays with course suspension), import (choose file → analysis → review), notes editor, forms and details for tâche/devoir/examen/événement, quick add, end of course, search, notifications (with sync retry), settings, colour sheet.

**Rule: all colours are editable in ONE place.** `src/shared/theme/colors.ts` holds named tokens (`primary`, `primarySoft`, `background`, `surface`, `text`, `muted`, `warning`, `danger`, `success`, plus a light and a dark set, and the subject palette). Screens and components never contain a hex code: they read `theme.colors.*`. A lint rule (no colour literals outside `theme/`) enforces it.

## 5c. Future versions

Ideas kept out of the MVP are described in [`VERSION_2.md`](VERSION_2.md). Main one: a school or teacher publishes **courses and a class timetable** from the app, with or without an account, and shares a **code**; students enter the code and receive them automatically.

## 5d. Completeness audit (23 Sep 2026)

Done after a walk-through showed gaps between "module exists" and "module complete". Added: profile (§6), appearance setting, event reminders (§40), holidays in the calendar (§37), notifications screen, notes listed on their class, next session date on the subject page, delete on detail screens, 'Ajouter une note' on the end-of-class prompt (§76–78).

**Safety nets now in place:** `src/test/screens.smoke.test.tsx` renders **every screen** against a real SQLite database seeded with a subject, timetable, class (with a cancelled session), exam, task, homework, event, note and holiday, and checks the expected texts; `src/shared/i18n/keys.test.ts` fails if a translation key used in code is missing.

**Polish (24 Sep 2026):** a loading screen while the database opens and while the first-launch check runs (no more blank screen); « Supprimer toutes mes données » in settings (double confirmation, wipes the database, attachments, backups and scheduled reminders, then returns to the intro); automatic daily backup of the whole local database to a JSON file in the app's private folder (last 7 kept, manual backup / share / restore from settings, attachments excluded — see `docs/SECURITY.md` §4e); sound and vibration toggles for reminders (Android: one channel per combination, since a channel cannot be changed once created); first day of the week (Monday / Saturday / Sunday) used by the calendar.

**Still out of scope until external accounts exist:** timetable import (phase 6, AI key), store assets (7b). Accounts + sync are built (§5g) and go live as soon as a Supabase project is configured.

## 5e. Lot 2 — engagement features (24 Sep 2026)

Requested by the product owner after the MVP walk-through. All local, no account needed; all covered by `npm run check` (unit tests on real SQLite + every screen rendered).

| Feature | Where | Notes |
|---|---|---|
| Exam grades and averages | exam form (« Résultat »), exam page, subject page, **Profil › Mes notes** (`/grades`) | `grade`, `grade_max`, `coefficient` on `exams` (migration v7). Weighted average per subject on 20, overall = mean of subject averages, bar chart of the history (drawn with views, no library). |
| Study timer (Pomodoro) | **Profil › Révision** (`/study`), clock icon on Today | `study_sessions` table. Presets 25/5, 45/10, 50/10, 90/15, linked to a subject. End-of-session notification even when the app is closed (planned like the other reminders). Weekly total per subject and per day. |
| Recurring tasks | task/homework form (« Répéter ») | `repeat_rule` on `tasks` and `assignments`. When a repeating item is marked done, the next one is created (due date, time and reminder shifted), exactly once. |
| Share a note as PDF | note page, share icon | `noteToHtml` (markup → escaped HTML) + `expo-print` + `expo-sharing`. |
| Calendar export (.ics) | calendar tab, share icon | `buildIcs`: classes (30 days back, 180 ahead, cancelled sessions excluded), exams, events, open tasks/homework (all-day). Opens in Calendrier iPhone / Google Agenda. |
| Weekly statistics | **Profil › Statistiques** (`/stats`) | Class hours, tasks done/open, study minutes per day, active-day streak (a day counts with a completed task or a study session). Pure projection `weekStats`, tested. |
| App lock | Réglages › Confidentialité | `expo-local-authentication` (Face ID / Touch ID / passcode). Locks at launch and after 30 s in background. Only offered when biometrics or a passcode are set up. |
| Focus mode | Réglages › Mode focus | Two switches: no reminders during a class (end-of-class kept), no reminders during a study session (session end kept). Applied in `planReminders` (`applyFocus`), tested. |

### Home-screen widgets (24 Sep 2026)

Eleven widgets and one Live Activity, same content on both platforms, built in TypeScript only (no Swift/Kotlin written by hand):

| Widget | iPhone (`expo-widgets`, WidgetKit) | Android (`react-native-android-widget`) | Content |
|---|---|---|---|
| **Prochain cours** | small, medium, Lock Screen rectangular + inline | 2×2 | Next class, time, room, "in 25 min" / "in progress" |
| **Aujourd'hui** | medium, large | 4×3 | Classes of the day (cancelled struck through), then tasks and exams |
| **Tâches** | small, medium, large | 2×2 | Due today + overdue, with counter |
| **Révision** | **Live Activity** (Lock Screen + Dynamic Island, live countdown) | 2×2 widget (end time + "Start" button) | Running study session or break |
| **Semaine** | medium, large | 4×2 | Study minutes per day (bars), weekly total, active-day streak |
| **Matière** | small, medium, **configurable** (long-press → subject name) | 2×2, **configurable** (long-press → pick a subject) | Next class, next due item, next exam, average, open tasks |
| **Examens** | small, medium | 2×2 | Countdown of the next exams (60 days) |
| **Notes rapides** | medium | 4×1 | Three buttons: new note, new task, new homework (deep links) |
| **Moyenne** | small, medium | 2×2 | Overall average, latest grade, per-subject averages |
| **Mois** | large | 4×4 | Month grid with dots for classes, due items, exams |
| **Habitudes** | small, medium, large | 2×2 | Today's habits, done or not, with count progress |

How it works: `src/projections/widget.ts` turns the agenda, study sessions and grades into plain, already-translated props (`buildWidgetData`, one object shared by every widget) and, for iOS, a timeline with one entry at each class start/end, at the end of the study session and at midnight (`buildWidgetTimeline`), so widgets move on without the app running. `WidgetsGate` (root layout) pushes the data on every data change and when the app comes to the foreground, and starts/updates/ends the Live Activity. On Android the app also writes `widget-snapshot.json` (data) and `widget-config.json` (subject chosen per widget id) in its documents folder; the background task handler and the configuration screen (`index.ts`) work from those files, without opening the database. Tapping a widget opens the app (`mysky://…` deep links: `notes/new`, `work/form?kind=task`, `study`, `grades`, `calendar`). Colours come from `colors.ts` through props (light and dark variants), never hard-coded in the widgets.

**Not testable in Expo Go.** Widgets and Live Activities are native extensions: they need a development build (`eas build --profile development`) and, on iPhone, an Apple developer account. In Expo Go the widget modules are absent; `syncWidgets` catches the error and logs it, the app keeps working. Layouts are typechecked and linted, both config plugins were verified with `expo prebuild` (10 Android providers + configuration activity, 10 Swift widget files + app group on iOS), and the data projection is unit-tested, but the rendering itself has not been seen on a device yet: expect a round of visual tuning (spacing, sizes) after the first dev build. Known Android limit: the « Révision » widget cannot tick every second (widgets there refresh on events only), so it shows the end time; iPhone gets the live countdown through the Live Activity.

## 5f. Habit board « Mes habitudes » (built 24 Sep 2026)

Validated by the product owner: card on Aujourd'hui + full screen from Profil, suggested habits, study sessions tick « Réviser ».

- **Habit** (`habits`): name, icon, colour, frequency (every day · chosen weekdays · N times a week), daily target with unit (8 glasses, "+1" button), optional reminder time, "tick with study sessions".
- **Day log** (`habit_logs`): done (count) / not done / excused, optional reason (quick chips: tired, no time, forgot, sick, other + free text, never mandatory). An excused day does not break the streak.
- **Where**: « Mes habitudes du jour » card on Aujourd'hui (tick, +1, "…" to log not done / excused with a reason); `/habits` board (today, weekly review "X of Y habits kept" with missed days and reasons, most frequent reasons, all habits with 30-day rate, suggestions to add in one tap); `/habits/[id]` (streak, 7/30-day rates, month calendar coloured by day state — tap a day to log it — missed/excused days with reasons); `/habits/form`.
- **Links**: a focus study session of ≥ 5 min ticks habits marked "tick with study sessions" (same transaction as the end of the session); habit reminders go through `planReminders` (7-day horizon, skipped once done, focus mode respected, setting « Rappels d'habitudes »); weekly statistics show "Habitudes respectées" and habits count as active days for the streak; « Habitudes » widget on iPhone and Android.
- **Rules** (pure, tested in `productivity/domain/habit.ts`): a day is done when the target is reached; past scheduled days with nothing logged count as missed; today never counts against you until it is over; "N times a week" streaks count weeks.
- Not gamification: no points, badges or leaderboards.

## 5g. Accounts and sync (built 24 Sep 2026)

Requested by the product owner for this version. The account is **optional**: without a configured Supabase project, or without signing in, the app keeps working fully offline on one phone.

- **Auth** (`identity/auth`): email + password (8+ chars, a letter and a digit), Apple and Google (Supabase OAuth in the phone's secure browser, PKCE), email confirmation and password reset by deep link (`mysky://auth/callback`, `mysky://auth/reset`), change password, sign out of this phone only (keep or erase the phone's copy), **account deletion** (Edge Function `delete-account`: files then user, rows cascade). Session kept in the Keychain / Keystore (`expo-secure-store`, chunked), never in plain storage.
- **Ownership**: the first account that signs in adopts the phone's existing data (it is pushed on the first sync). If another account's data is on the phone, the user must erase it first; data is never mixed.
- **Sync engine** (`platform/sync`): push = the `sync_outbox` grouped per item with the known version, sent to the SQL function `mysky_push` (idempotent by mutation id, optimistic versioning). Pull = rows with `server_updated_at` > per-table cursor, parents first, local unsent edits never overwritten. Conflict = the most recent `updated_at` wins; if the server's wins, the local copy is saved in `sync_conflicts` (count shown on the account page, kept in backups). Files (attachments, profile photo) follow their rows in the private bucket `mysky-files/<user id>/…`. Runs at launch, on foreground, 4 s after a change and every 5 min; one run at a time; offline → retried later.
- **Server** (`supabase/`): schema **generated from the phone's schema** (test fails if out of date), RLS `user_id = auth.uid()` on every table, storage policy per user folder. Verified on a real Postgres engine (PGlite) by `npm run test:server` (part of `npm run check`): versions, replay, conflicts, isolation between two users, cascade delete.
- **Screens**: Profil › Compte et synchronisation (`/account`), `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot`, `/auth/callback`, `/auth/reset`; onboarding offers « J'ai déjà un compte ».
- **To go live** (product owner): create the Supabase project (choose the region), run the SQL, deploy the function, set redirect URLs and providers, fill `.env.local` — step by step in `supabase/README.md`. Then fill `serverRegion` in `src/shared/legal.ts`.
- **Legal note (Cameroon, Law No. 2024/017)**: with accounts, the publisher processes personal data; hosting outside Cameroon is a cross-border transfer that the law subjects to prior authorisation by the data protection authority. To check with a local lawyer before launch.

## 5h. Lot 4 — planning, gestures and personalisation (built 24 Sep 2026)

Requested by the product owner (« Je veux tout ça »). Local migration **v10**; server schema regenerated (re-running the SQL file upgrades an existing project).

- **Revision plan** (`/revision/plan?examId`, from the exam page): pure planner `projections/revisionPlan.ts` spreads N sessions of the chosen length over the days before the exam (last one the day before), inside a time window, avoiding classes, exams, events and other revisions (15-min margin), several per day if needed, and says how many did not fit. Nothing is saved until the student removes the slots they don't want and confirms; « Refaire le plan » replaces the sessions still planned. Sessions are `revision_blocks` (planned / done / skipped) with a detail screen: start the study timer (the session is linked; ≥ 5 min marks the revision done), mark done, skip, edit, delete. Reminder 10 min before (setting « Révisions prévues »), shown in the calendar, on Aujourd'hui and in the .ics export.
- **Timetable types**: `timetables.kind` = courses · exams · revision. The timetables screen groups them by type (exams and revision sessions listed under their timetable); the course form only offers course timetables; the exam form offers an exam session (`exams.timetable_id`). Saving a revision plan creates or extends the « Révisions » timetable.
- **Subtasks and estimated time**: checklist on a task or homework (`work_subtasks`: add, tick, reorder, remove), progress « 2/5 étapes » in lists; a repeated task copies its checklist unticked; deleting the task deletes its steps. Estimated time (15 min – 2 h) on the form, shown in lists and used by the hours view and the evening review.
- **Swipe** (`SwipeRow`, react-native-gesture-handler `ReanimatedSwipeable`): in Tâches and Aujourd'hui, swipe right = done, swipe left = postpone (tomorrow, in 2 days, next Monday, other date). The reminder moves with the due date. Same actions stay available without gestures (checkbox, detail screen « Reporter »).
- **Hours view** (Calendrier › Heures): week in columns, hours in rows, overlaps side by side; long-press then drag a class, task, revision or event to another day / time (15-min snap). A class move asks for confirmation and changes **only that session** (`course_exceptions.new_date` + new times; `Occurrence.originalDate` stays the key for notes, reminders and exceptions). Filter chips by type in every calendar view.
- **Evening review** (`/review`): what is left today (tick or postpone, « Tout reporter à demain »), today's revisions, habits, mood, tomorrow's preview with planned work time. Daily reminder at the chosen time (Réglages › Bilan du soir, respects focus mode); a card on Aujourd'hui from 2 h before.
- **Mood and energy journal** (`mood_logs`, one entry per day, 1–5 each, optional note): in the evening review and `/mood` (7-day chart, averages, recent entries), and per habit « énergie les jours faits / les autres » over 30 days (shown only with at least 2 days on each side, presented as a trend). Summary card in weekly statistics.
- **Personalisation**: main colour (6 presets, contrast-tested in both modes) and text size (4 steps, on top of the phone's setting) in Réglages › Apparence; order and visibility of the Aujourd'hui sections (`/today-layout`).

## 5i. Module Argent (built 25 Sep 2026)

Requested by the product owner, with the mock-ups validated on the canvas « MySky — module Argent ». New domain module `src/modules/finance` (fifth domain next to identity, academic, productivity, platform), local migration **v11**, server schema regenerated.

- **Navigation**: tabs are now Aujourd'hui · Calendrier · Tâches · Notes · **Argent**. The Profil tab became the photo / initials button at the top right of Aujourd'hui (`/profile`), same page as before.
- **Principle**: the app is connected to no bank and no Mobile Money account. The student enters everything; « Il te reste » = what was carried over + income − everything that went out.
- **Entries** (`money_transactions`, integer amounts in the currency's smallest unit): expense, income, put aside / taken back (savings goal), lent / paid back to me, borrowed / repaid. Quick entry `/money/add`: expense or income → category (16 + 7 built-in, tailored for students in Cameroon, plus the student's own) → amount on a keypad → save; today's date by default, shown, changeable.
- **Currency**: FCFA (XAF) by default, 9 others selectable (Réglages de l'argent). Totals only add entries of the chosen currency.
- **Budget period**: a month starting on the day the student chooses (1st by default, e.g. the 25th; 31 = last day of shorter months) or a week starting on the chosen day. Every screen and report follows it; previous / next periods browsable.
- **Fixed costs and tontines** (`money_recurring`): monthly (day of month) or weekly (weekday, time), 1–3 reminders chosen among 10 min / 1 h / 3 h / the day before / 2 or 3 days before; tick « payé » and the expense is created (linked to that due date, undo possible). From the start of the period the app shows « À payer » and « Après tes charges fixes : X · soit Y par jour ». Tontine: contribution + **my turn** (date, amount), counted **automatically as income** on the day by default (`recordDuePayouts`, once per turn, switchable per tontine, the entry stays editable); reminder on the day.
- **Savings goals** (`money_goals`) and **loans** (`money_loans`, « on me doit » / « je dois », repayments, due date, settled).
- **Report** `/money/report`: income, expenses, put aside, lent; where the money goes (by category), where it comes from, spending by weekday, biggest expenses, and simple insights (day you spend most, category up ≥ 20 %, an expense that repeats → « en faire une charge fixe »). All pure functions in `projections/money.ts`, tested.
- **Elsewhere**: « Dépensé aujourd'hui » card on Aujourd'hui (movable section), money of the day in the evening review, reminders in `planReminders` (setting « Argent : charges fixes et tontines », focus mode respected).
- **Widgets** (iPhone + Android): « Dépense rapide » (the 3 most used categories + Autre open the entry screen with the category chosen — a widget cannot receive typed text), « Il te reste » (also on the lock screen), « Mes dépenses » (7 days + what's due). Option « Masquer les montants dans les widgets ».
- Out of scope for now: bank / Mobile Money import, per-category budgets, shared expenses.

## 6. Open questions for the product owner

**Decided:** backend = Supabase · languages = French + English · working name = **MySky** (check the name is free before the store release) · bundle id / package = `com.skiadac.mysky` · minimum OS = iOS 16.4+ (Expo SDK 57 minimum), Android 8.0+ (API 26) · tabs = Aujourd'hui · Calendrier · Tâches · Notes · Argent (Profil via the photo at the top right, 25 Sep 2026) · import AI budget OK (a few cents per page).

1. Design: direction set in section 5b, mock-ups done. Next step: mock-ups of the key screens (Aujourd'hui, Calendrier, Tâches) before coding.
