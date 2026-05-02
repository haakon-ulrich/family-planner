import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';

const DB_PATH = process.env.DB_PATH ?? './data/app.db';

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

migrate(db, { migrationsFolder });
console.log('Migrations applied.');
sqlite.close();
