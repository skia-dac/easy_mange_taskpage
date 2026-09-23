# Planning — Student Organisation App (Expo, Android + iOS)

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

1. **§4 Navigation is empty.** Proposal (5 tabs):
   `Aujourd'hui` · `Calendrier` · `Matières` · `Tâches` (tâches + devoirs + examens) · `Notes`.
   Search, Profile/Settings and Notifications are reached from the header. The quick-add “+” button is on Aujourd'hui and Calendrier.
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
| Local DB | **expo-sqlite + Drizzle ORM** | The local DB is the source of truth for the UI. This gives offline mode directly. |
| Sync | Custom sync engine: outbox push with a version check + pull by server cursor | Behaviour is defined in section 4.4. |
| State / queries | TanStack Query or Drizzle live queries + Zustand for UI state | |
| Forms | react-hook-form + zod | The same zod schemas validate forms and import rows. |
| Dates | date-fns + date-fns-tz, rrule for recurrence | |
| Calendar UI | `@howljs/calendar-kit` (day/week) + `react-native-calendars` (month/agenda) | |
| Rich notes | **10tap-editor** (TipTap-based) | Covers titles, bold, italic, lists, checklists. Store content as JSON + plain text for search. |
| Notifications | expo-notifications (local), with action buttons for end of course | Rolling scheduling window of about 60 notifications, refilled on app open and in background. |
| Files | expo-document-picker, expo-image-picker, expo-file-system | |
| Import analysis | `ai-import` Edge Function → vision LLM, returns strict JSON with per-field confidence | Produces an `ImportedTimetableDraft` only. It never creates `CourseSeries` (arch. §8). |
| Search | SQLite FTS5 on the local DB | Works offline, covers all entity types. |
| i18n | French first (i18next), English-ready | |

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

### 4.2 Folder structure (the four domains of arch. §4)

```
app/                          # Expo Router routes only (thin; they call modules/*/ui)
  (auth)/  (tabs)/today  (tabs)/calendar  (tabs)/subjects  (tabs)/tasks  (tabs)/notes
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
- **platform:** `personal_events`, `import_jobs`, `imported_timetable_drafts` (rows with a confidence value or a "à vérifier" flag), `mutations_applied`

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
| **0. Setup** | Remove the old Flutter code, create the Expo project with the module structure + boundary lint, tests, EAS, Supabase project, design tokens | Empty app runs on both platforms |
| **1. Local core (offline by design)** | Subjects, timetables, course series (weekly), calendar + Today projections, tasks/assignments/exams/events, confirmations, empty states. Sync metadata columns and the outbox already written, but no server yet | Fully usable app on one device, no account |
| **2. Accounts + sync** | Email/Google/Apple auth, profile, onboarding, Supabase schemas + RLS, `sync` function (versions, idempotence), conflict screen, retry, account deletion | Data restored on a new device |
| **3. Notifications** | Course/homework/task/exam reminders, end-of-course actions with prefilled forms, settings, rolling scheduler | Acceptance criteria 17–19 |
| **4. Advanced timetable** | Per-occurrence edits (3 options), cancellations, holidays/days off with suspension | Criteria 6, rule 8 |
| **5. Notes** | Rich editor, attachments (offline queue), favorites, "take notes" from a course | Criteria 9–10 |
| **6. Import** | Pick PDF/image → Edge Function → editable preview with uncertain-field flags → duplicate check → create subjects + courses | Criteria 7, 8, 23, 24 |
| **7. Search + polish** | Global FTS search, error messages, accessibility, store assets, TestFlight / Play internal testing | Launch candidate |

Phase 1 comes before auth on purpose. Building local-first from the start is what makes offline mode reliable. Adding it at the end rarely works.

---

## 6. Open questions for the product owner

1. Confirm the 5 tabs proposed in §2.1.
2. Backend: Supabase OK? (alternative: Firebase)
3. App languages: French only, or French + English?
4. Import model/provider and budget per import (a vision LLM costs a few cents per page).
5. Minimum OS versions (proposal: iOS 16+, Android 8+).
6. App name and bundle id (old project used `easyptt` / `easypage`).
7. Is there an existing design (Figma), or do we define a simple design system in Phase 0?
