import { showError } from '../ui/dialogs';

/** Un seul message pour plusieurs lectures en échec rapprochées (un écran en lance plusieurs). */
const LOAD_ERROR_QUIET_MS = 5000;
let lastLoadErrorAt = 0;

export function notifyLoadError(): void {
  const now = Date.now();
  if (now - lastLoadErrorAt < LOAD_ERROR_QUIET_MS) return;
  lastLoadErrorAt = now;
  showError('errors.loadFailed');
}
