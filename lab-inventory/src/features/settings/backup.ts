import { download } from '../../domain/csv';
import { todayStr } from '../../domain/dates';
import { markBackup } from '../../store/actions';
import { exportJSON } from '../../store/store';

export function downloadBackup() {
  // Record the time first, so the file itself carries it and a restore does not start the reminders again
  markBackup();
  download(`lab-inventory-backup-${todayStr()}.json`, exportJSON(), 'application/json');
}
