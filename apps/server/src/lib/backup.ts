import path from 'path';
import fs from 'fs/promises';
import { eq } from 'drizzle-orm';
import { db, sqlite } from '@server/db/index';
import { settings as settingsTable } from '@server/db/schema';
import { broadcast } from '@server/sse';
import { log } from '@server/logger';

const KEEP_BACKUPS = 7;
const DEFAULT_BACKUP_DIR = './data/backups';

export const runBackup = async (): Promise<void> => {
  const backupDir = process.env.BACKUP_DIR ?? DEFAULT_BACKUP_DIR;

  await fs.mkdir(backupDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `family-planner-backup-${date}.db`;
  const destPath = path.join(backupDir, fileName);

  // Consistent online snapshot — WAL-safe via better-sqlite3
  await sqlite.backup(destPath);

  // Prune: keep only the KEEP_BACKUPS most recent backup files
  const entries = await fs.readdir(backupDir);
  const backupFiles = entries
    .filter((f) => f.startsWith('family-planner-backup-') && f.endsWith('.db'))
    .sort()
    .reverse();

  for (const old of backupFiles.slice(KEEP_BACKUPS)) {
    await fs.unlink(path.join(backupDir, old));
  }

  const now = new Date().toISOString();
  db.update(settingsTable).set({ lastBackupAt: now }).where(eq(settingsTable.id, 1)).run();
  broadcast({ type: 'settings-changed', payload: {} });

  log.info({ destPath, pruned: Math.max(0, backupFiles.length - KEEP_BACKUPS) }, 'Backup completed');
};
