// Module platform : notifications, fichiers (import, synchronisation, recherche : phases suivantes).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export {
  HORIZON_DAYS,
  MAX_COURSE_REMINDERS,
  MAX_SCHEDULED,
  planReminders,
} from './notifications/plan';
export {
  defineNotificationsTask,
  NOTIFICATIONS_TASK,
  refreshNotificationsInBackground,
} from './notifications/backgroundTask';
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
  takePhoto,
} from './files/attachments';
export type { PickedFile } from './files/attachments';
export { cancelAllReminders, readableParams } from './notifications/scheduler';
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
export { conflictCount, pendingCount, syncOnce } from './sync/engine';
export type {
  Mutation,
  PullCursor,
  PushResult,
  RemoteApi,
  SyncedTable,
  SyncReport,
} from './sync/engine';
export { PULL_MARGIN_MS, withMargin } from './sync/remote';
export { cancelSyncRetry, pendingRetryDelay, runSync } from './sync/runner';
export { ignoreConflict, listConflicts, restoreConflict } from './sync/conflicts';
export type { SyncConflict } from './sync/conflicts';
export { getSyncStatus, useSyncStatus } from './sync/status';
export type { SyncStatus } from './sync/status';
export { SyncGate } from './sync/SyncGate';
export {
  CONTACT_MAX,
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  feedbackInputSchema,
  MESSAGE_MAX,
  MESSAGE_MIN,
  PREVIEW_LENGTH,
  previewOf,
  safeErrorName,
} from './feedback/domain';
export type {
  Feedback,
  FeedbackArea,
  FeedbackContext,
  FeedbackInput,
  FeedbackKind,
  FeedbackStatus,
} from './feedback/domain';
export {
  createFeedback,
  FEEDBACK_TABLE,
  feedbackCounts,
  getDeviceRef,
  listFeedback,
} from './feedback/data';
export {
  deleteFeedback,
  FEEDBACK_FOLDER,
  feedbackContext,
  retryFeedback,
  sendFeedbackByEmail,
  sendPendingFeedback,
  submitFeedback,
} from './feedback/service';
export type { FeedbackSendReport, SubmitOutcome } from './feedback/service';
export { FeedbackGate } from './feedback/FeedbackGate';
