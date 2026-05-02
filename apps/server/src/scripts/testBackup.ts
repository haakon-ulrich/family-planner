import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../.env') });

const { runBackup } = await import('@server/lib/backup');

console.log('Starting backup…');
await runBackup();
console.log('Done.');
process.exit(0);
