import type { Migration } from './migrate';

/**
 * Colonnes communes à toutes les données synchronisées (architecture §7.2).
 * À utiliser dans chaque table métier (matières, cours, notes…) à partir de la phase 1.
 */
export const SYNC_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
    CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'conflict'))
`;

/**
 * Liste des migrations. Règles :
 * - ne JAMAIS modifier une migration déjà publiée : en ajouter une nouvelle à la fin ;
 * - les numéros se suivent (1, 2, 3…), un test le vérifie.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'socle : réglages et file de synchronisation',
    sql: `
      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sync_outbox (
        mutation_id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        payload TEXT NOT NULL,
        base_version INTEGER,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      CREATE INDEX idx_sync_outbox_created_at ON sync_outbox (created_at);
    `,
  },
  {
    version: 2,
    name: 'phase 1 : matières, emplois du temps, cours, examens, tâches, devoirs, événements',
    sql: `
      CREATE TABLE subjects (${SYNC_COLUMNS},
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        code TEXT,
        teacher TEXT,
        room TEXT,
        color_id TEXT NOT NULL,
        semester TEXT,
        description TEXT
      );

      CREATE TABLE timetables (${SYNC_COLUMNS},
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        valid_from TEXT NOT NULL,
        valid_until TEXT NOT NULL,
        CHECK (valid_until >= valid_from)
      );

      CREATE TABLE course_series (${SYNC_COLUMNS},
        subject_id TEXT NOT NULL REFERENCES subjects (id),
        timetable_id TEXT REFERENCES timetables (id),
        title TEXT,
        teacher TEXT,
        room TEXT,
        course_type TEXT NOT NULL,
        weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        valid_from TEXT NOT NULL,
        valid_until TEXT NOT NULL,
        recurrence TEXT NOT NULL CHECK (recurrence IN ('none', 'weekly')),
        description TEXT,
        CHECK (end_time > start_time),
        CHECK (valid_until >= valid_from)
      );
      CREATE INDEX idx_course_series_subject ON course_series (subject_id);

      CREATE TABLE exams (${SYNC_COLUMNS},
        subject_id TEXT NOT NULL REFERENCES subjects (id),
        title TEXT,
        date TEXT NOT NULL,
        time TEXT,
        duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
        room TEXT,
        description TEXT
      );
      CREATE INDEX idx_exams_date ON exams (date);

      CREATE TABLE tasks (${SYNC_COLUMNS},
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        description TEXT,
        subject_id TEXT REFERENCES subjects (id),
        due_date TEXT NOT NULL,
        due_time TEXT,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'important', 'urgent')),
        status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
        completed_at TEXT
      );
      CREATE INDEX idx_tasks_due ON tasks (due_date);

      CREATE TABLE assignments (${SYNC_COLUMNS},
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        description TEXT,
        subject_id TEXT REFERENCES subjects (id),
        due_date TEXT NOT NULL,
        due_time TEXT,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'important', 'urgent')),
        status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
        completed_at TEXT
      );
      CREATE INDEX idx_assignments_due ON assignments (due_date);

      CREATE TABLE personal_events (${SYNC_COLUMNS},
        title TEXT NOT NULL CHECK (length(trim(title)) > 0),
        date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        description TEXT,
        CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
      );
      CREATE INDEX idx_personal_events_date ON personal_events (date);
    `,
  },
  {
    version: 3,
    name: 'phase 4 : exceptions de cours et périodes sans cours',
    sql: `
      CREATE TABLE course_exceptions (${SYNC_COLUMNS},
        series_id TEXT NOT NULL REFERENCES course_series (id),
        date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('cancelled', 'modified')),
        new_start_time TEXT,
        new_end_time TEXT,
        new_room TEXT,
        new_teacher TEXT,
        new_title TEXT,
        note TEXT,
        CHECK (new_end_time IS NULL OR new_start_time IS NULL OR new_end_time > new_start_time)
      );
      CREATE INDEX idx_course_exceptions_series ON course_exceptions (series_id, date);

      CREATE TABLE off_periods (${SYNC_COLUMNS},
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        kind TEXT NOT NULL CHECK (kind IN ('holiday', 'day_off')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        suspend_courses INTEGER NOT NULL DEFAULT 1 CHECK (suspend_courses IN (0, 1)),
        CHECK (end_date >= start_date)
      );
      CREATE INDEX idx_off_periods_dates ON off_periods (start_date, end_date);
    `,
  },
  {
    version: 4,
    name: 'phase 3 : rappels',
    sql: `
      ALTER TABLE course_series ADD COLUMN reminder_minutes INTEGER;
      ALTER TABLE assignments ADD COLUMN reminder_at TEXT;
      ALTER TABLE tasks ADD COLUMN reminder_at TEXT;
      ALTER TABLE exams ADD COLUMN reminder_days TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE exams ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '09:00';
    `,
  },
  {
    version: 5,
    name: 'phase 5 : notes et pièces jointes',
    sql: `
      CREATE TABLE notes (${SYNC_COLUMNS},
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        subject_id TEXT REFERENCES subjects (id),
        course_series_id TEXT REFERENCES course_series (id),
        course_date TEXT,
        is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1))
      );
      CREATE INDEX idx_notes_subject ON notes (subject_id);
      CREATE INDEX idx_notes_updated ON notes (updated_at);

      CREATE TABLE attachments (${SYNC_COLUMNS},
        note_id TEXT NOT NULL REFERENCES notes (id),
        kind TEXT NOT NULL CHECK (kind IN ('image', 'file')),
        name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER,
        local_path TEXT NOT NULL,
        remote_path TEXT,
        upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploaded', 'failed'))
      );
      CREATE INDEX idx_attachments_note ON attachments (note_id);
    `,
  },
  {
    version: 6,
    name: 'profil, rappel des événements',
    sql: `
      CREATE TABLE profiles (${SYNC_COLUMNS},
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        photo_path TEXT,
        university TEXT,
        field TEXT,
        level TEXT,
        academic_year TEXT
      );
      ALTER TABLE personal_events ADD COLUMN reminder_at TEXT;
    `,
  },
  {
    version: 7,
    name: 'notes d’examen, tâches récurrentes, sessions de révision',
    sql: `
      ALTER TABLE exams ADD COLUMN grade REAL;
      ALTER TABLE exams ADD COLUMN grade_max REAL NOT NULL DEFAULT 20;
      ALTER TABLE exams ADD COLUMN coefficient REAL NOT NULL DEFAULT 1;
      ALTER TABLE tasks ADD COLUMN repeat_rule TEXT NOT NULL DEFAULT 'none';
      ALTER TABLE assignments ADD COLUMN repeat_rule TEXT NOT NULL DEFAULT 'none';
      CREATE TABLE study_sessions (${SYNC_COLUMNS},
        subject_id TEXT REFERENCES subjects (id),
        started_at TEXT NOT NULL,
        ended_at TEXT,
        planned_minutes INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'focus'
      );
      CREATE INDEX idx_study_sessions_started ON study_sessions (started_at);
    `,
  },
  {
    version: 8,
    name: 'habitudes',
    sql: `
      CREATE TABLE habits (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'check-circle',
        color_id TEXT NOT NULL DEFAULT 'blue',
        frequency TEXT NOT NULL DEFAULT 'daily',
        weekdays TEXT NOT NULL DEFAULT '[]',
        times_per_week INTEGER NOT NULL DEFAULT 1,
        target INTEGER NOT NULL DEFAULT 1,
        unit TEXT,
        reminder_time TEXT,
        auto_study INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE habit_logs (${SYNC_COLUMNS},
        habit_id TEXT NOT NULL REFERENCES habits (id),
        date TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'done',
        reason_code TEXT,
        reason TEXT
      );
      CREATE INDEX idx_habit_logs_habit_date ON habit_logs (habit_id, date);
    `,
  },
  {
    version: 9,
    name: 'synchronisation : conflits et fichiers envoyés',
    sql: `
      CREATE TABLE sync_conflicts (
        id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        local_payload TEXT NOT NULL,
        server_payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE TABLE sync_files (
        path TEXT PRIMARY KEY NOT NULL,
        synced_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: 'types d’emploi du temps, sous-tâches, plan de révision, humeur',
    sql: `
      ALTER TABLE timetables ADD COLUMN kind TEXT NOT NULL DEFAULT 'courses';
      ALTER TABLE exams ADD COLUMN timetable_id TEXT REFERENCES timetables (id);
      ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER;
      ALTER TABLE assignments ADD COLUMN estimated_minutes INTEGER;
      ALTER TABLE course_exceptions ADD COLUMN new_date TEXT;
      CREATE TABLE work_subtasks (${SYNC_COLUMNS},
        work_kind TEXT NOT NULL,
        work_id TEXT NOT NULL,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX idx_work_subtasks_parent ON work_subtasks (work_kind, work_id);
      CREATE TABLE revision_blocks (${SYNC_COLUMNS},
        subject_id TEXT REFERENCES subjects (id),
        exam_id TEXT REFERENCES exams (id),
        timetable_id TEXT REFERENCES timetables (id),
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'planned',
        study_session_id TEXT
      );
      CREATE INDEX idx_revision_blocks_date ON revision_blocks (date);
      CREATE TABLE mood_logs (${SYNC_COLUMNS},
        date TEXT NOT NULL,
        mood INTEGER NOT NULL,
        energy INTEGER NOT NULL,
        note TEXT
      );
      CREATE INDEX idx_mood_logs_date ON mood_logs (date);
    `,
  },
  {
    version: 11,
    name: 'argent : opérations, catégories, charges fixes et tontines, épargne, prêts',
    sql: `
      CREATE TABLE money_categories (${SYNC_COLUMNS},
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'tag',
        color_id TEXT NOT NULL DEFAULT 'slate',
        position INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE money_goals (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        target_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        deadline TEXT,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE money_loans (${SYNC_COLUMNS},
        direction TEXT NOT NULL,
        person TEXT NOT NULL,
        due_date TEXT,
        note TEXT,
        closed INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE money_recurring (${SYNC_COLUMNS},
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        category_id TEXT,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        frequency TEXT NOT NULL,
        day_of_month INTEGER NOT NULL DEFAULT 1,
        weekday INTEGER NOT NULL DEFAULT 6,
        time TEXT,
        reminders TEXT NOT NULL DEFAULT '[]',
        start_date TEXT NOT NULL,
        end_date TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        payout_date TEXT,
        payout_minor INTEGER,
        payout_auto INTEGER NOT NULL DEFAULT 1,
        payout_recorded INTEGER NOT NULL DEFAULT 0,
        note TEXT
      );
      CREATE TABLE money_transactions (${SYNC_COLUMNS},
        kind TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        category_id TEXT,
        date TEXT NOT NULL,
        note TEXT,
        recurring_id TEXT REFERENCES money_recurring (id),
        occurrence_date TEXT,
        goal_id TEXT REFERENCES money_goals (id),
        loan_id TEXT REFERENCES money_loans (id)
      );
      CREATE INDEX idx_money_transactions_date ON money_transactions (date);
      CREATE INDEX idx_money_transactions_recurring ON money_transactions (recurring_id, occurrence_date);
    `,
  },
  {
    version: 12,
    name: 'espaces Études / Pro / Perso sur les tâches, devoirs, événements et notes',
    sql: `
      ALTER TABLE tasks ADD COLUMN space TEXT NOT NULL DEFAULT 'personal';
      ALTER TABLE assignments ADD COLUMN space TEXT NOT NULL DEFAULT 'study';
      ALTER TABLE personal_events ADD COLUMN space TEXT NOT NULL DEFAULT 'personal';
      ALTER TABLE notes ADD COLUMN space TEXT NOT NULL DEFAULT 'personal';
      UPDATE tasks SET space = 'study' WHERE subject_id IS NOT NULL;
      UPDATE notes SET space = 'study' WHERE subject_id IS NOT NULL OR course_series_id IS NOT NULL;
    `,
  },
  {
    version: 13,
    name: 'notes : catégories créées par l’utilisateur',
    sql: `
      CREATE TABLE note_categories (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        color_id TEXT NOT NULL DEFAULT 'slate',
        position INTEGER NOT NULL DEFAULT 0
      );
      ALTER TABLE notes ADD COLUMN category_id TEXT REFERENCES note_categories (id);
    `,
  },
  {
    version: 14,
    name: 'planning : créneaux fixes (chaque semaine ou semaine A / B)',
    sql: `
      CREATE TABLE work_slots (${SYNC_COLUMNS},
        title TEXT NOT NULL,
        weekdays TEXT NOT NULL DEFAULT '[]',
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        location TEXT,
        note TEXT,
        rotation TEXT NOT NULL DEFAULT 'every',
        valid_from TEXT NOT NULL,
        valid_until TEXT,
        color_id TEXT NOT NULL DEFAULT 'blue',
        space TEXT NOT NULL DEFAULT 'work'
      );
    `,
  },
  {
    version: 15,
    name: 'habitudes : durée d’une séance, suivi physique (photo et poids)',
    sql: `
      ALTER TABLE habits ADD COLUMN tracks_body INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE habit_logs ADD COLUMN duration_minutes INTEGER;
      CREATE TABLE habit_checkpoints (${SYNC_COLUMNS},
        habit_id TEXT NOT NULL REFERENCES habits (id),
        date TEXT NOT NULL,
        weight_kg REAL,
        photo_path TEXT,
        note TEXT
      );
      CREATE INDEX idx_habit_checkpoints_habit ON habit_checkpoints (habit_id, date);
      UPDATE habits SET tracks_body = 1 WHERE icon = 'activity';
    `,
  },
  {
    version: 16,
    name: 'prêts : devise ; exceptions de cours : une seule ligne vivante par (série, date)',
    sql: `
      ALTER TABLE money_loans ADD COLUMN currency TEXT NOT NULL DEFAULT 'XAF';
      UPDATE money_loans SET currency = (
        SELECT currency FROM money_transactions
        WHERE loan_id = money_loans.id ORDER BY date, created_at LIMIT 1
      ) WHERE EXISTS (SELECT 1 FROM money_transactions WHERE loan_id = money_loans.id);
      CREATE UNIQUE INDEX idx_course_exceptions_series_date_alive
        ON course_exceptions (series_id, date) WHERE deleted_at IS NULL;
    `,
  },
  {
    version: 17,
    name: 'retours des utilisateurs (« Donner mon avis ») : table locale, hors synchronisation',
    sql: `
      CREATE TABLE feedback (
        id TEXT PRIMARY KEY NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('bug', 'idea', 'other')),
        area TEXT NOT NULL DEFAULT 'other',
        message TEXT NOT NULL,
        blocking INTEGER NOT NULL DEFAULT 0,
        contact_email TEXT,
        screenshot_path TEXT,
        error_name TEXT,
        app_version TEXT NOT NULL,
        os TEXT NOT NULL,
        locale TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
        sent_at TEXT,
        created_at TEXT NOT NULL,
        error_code TEXT
      );
      CREATE INDEX idx_feedback_status ON feedback (status, created_at);
    `,
  },
];
