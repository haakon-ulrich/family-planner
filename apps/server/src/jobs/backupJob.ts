import cron from 'node-cron';
import { runBackup } from '@server/lib/backup';
import { log } from '@server/logger';

export const startBackupJob = (): void => {
  // Daily at 03:00 server local time
  cron.schedule('0 3 * * *', () => {
    runBackup().catch((err) => log.error({ err }, 'Backup failed'));
  });

  log.info('Backup job scheduled (daily at 03:00)');
};
