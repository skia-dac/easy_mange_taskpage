// Module platform : notifications, fichiers (import, synchronisation, recherche : phases suivantes).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export { HORIZON_DAYS, MAX_SCHEDULED, planReminders } from './notifications/plan';
export type { PlannedReminder, ReminderAction } from './notifications/plan';
export { routeForResponse } from './notifications/route';
export {
  ensurePermission,
  hasPermission,
  syncScheduledNotifications,
} from './notifications/scheduler';
export { NotificationsGate } from './notifications/NotificationsGate';
export { useNotifications } from './notifications/useNotifications';
export {
  attachmentExists,
  attachmentUri,
  deleteLocalFile,
  formatSize,
  MAX_ATTACHMENT_MB,
  pickDocument,
  pickImage,
} from './files/attachments';
export type { PickedFile } from './files/attachments';
export { cancelAllReminders } from './notifications/scheduler';
export { deleteAllAttachments } from './files/attachments';
export {
  autoBackupIfDue,
  BACKUPS_KEPT,
  deleteAllBackups,
  listBackups,
  pickBackupFile,
  readBackup,
  restoreBackup,
  shareBackup,
  writeBackup,
} from './backup/files';
export type { BackupFile } from './backup/files';
export { clearDatabase, snapshotSummary } from './backup/snapshot';
export type { BackupSnapshot } from './backup/snapshot';
export { BackupGate } from './backup/BackupGate';
export { canUseAppLock, LockGate } from './lock/LockGate';
export { buildIcs } from './export/ics';
export { safeFileName, shareIcs, sharePdf } from './export/share';
export { WidgetsGate } from './widgets/WidgetsGate';
export { syncWidgets } from './widgets/sync';
export { widgetTaskHandler } from './widgets/android/taskHandler';
export { SubjectConfigScreen } from './widgets/android/SubjectConfigScreen';
