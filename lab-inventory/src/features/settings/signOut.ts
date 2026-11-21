import { confirmDialog } from '../../components/toast';
import { signOut } from '../../sync/auth';
import { getEngine, stopSync, syncNow } from '../../sync/controller';

/** Finishes saving, signs out, and reloads so nothing of the shared data stays in memory on this computer. */
export async function signOutAndReload() {
  await syncNow();
  if (getEngine()?.hasUnsaved()) {
    const ok = await confirmDialog({
      title: 'Some changes have not been saved yet',
      body: 'They could not reach the shared database (the connection may be down). If you sign out now they are lost.',
      confirm: 'Sign out and lose them', danger: true,
    });
    if (!ok) return;
  }
  await stopSync();
  await signOut();
  location.reload();
}
