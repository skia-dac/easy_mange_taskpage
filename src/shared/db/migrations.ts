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
];
