import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { MIGRATIONS } from "./schema";
import { loadDatabaseFile, saveDatabaseFile } from "./storage";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export type Row = Record<string, unknown>;

export function isReady() {
  return !!db;
}

export function getDb(): Database {
  if (!db) throw new Error("The local database is not open yet.");
  return db;
}

export async function openDatabase(): Promise<Database> {
  if (db) return db;
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  }
  const existing = await loadDatabaseFile();
  db = existing && existing.byteLength > 0 ? new SQL.Database(existing) : new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

function migrate(database: Database) {
  const current = Number(
    (database.exec("PRAGMA user_version")[0]?.values?.[0]?.[0] as number) ?? 0,
  );
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      database.run(m.sql);
      database.run(`PRAGMA user_version = ${m.version}`);
    }
  }
}

/** Snapshot of the whole database file - used for saving and backups. */
export function exportBytes(): Uint8Array {
  return getDb().export();
}

export async function persist(): Promise<void> {
  if (!db) return;
  await saveDatabaseFile(exportBytes());
}

/** Debounced save so rapid typing does not rewrite the file constantly. */
export function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persist();
  }, 400);
}

export async function replaceDatabase(bytes: Uint8Array): Promise<void> {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  db?.close();
  db = new SQL.Database(bytes);
  db.run("PRAGMA foreign_keys = ON;");
  migrate(db);
  await persist();
}

export function closeDatabase() {
  db?.close();
  db = null;
}

// ---------------------------------------------------------------- queries

export type Param = string | number | null | Uint8Array;

export function all<T = Row>(sql: string, params: Param[] = []): T[] {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as never);
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as T);
    return out;
  } finally {
    stmt.free();
  }
}

export function one<T = Row>(sql: string, params: Param[] = []): T | null {
  return all<T>(sql, params)[0] ?? null;
}

export function scalar<T = number>(sql: string, params: Param[] = []): T | null {
  const r = one<Row>(sql, params);
  if (!r) return null;
  const v = Object.values(r)[0];
  return (v ?? null) as T | null;
}

export function run(sql: string, params: Param[] = []): void {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as never);
    stmt.step();
  } finally {
    stmt.free();
  }
}

export function insert(sql: string, params: Param[] = []): number {
  run(sql, params);
  return Number(scalar<number>("SELECT last_insert_rowid()") ?? 0);
}

/**
 * Runs everything inside a single SQLite transaction.
 * Any thrown error rolls the whole thing back - never a half-saved bill.
 */
export function transaction<T>(fn: () => T): T {
  const database = getDb();
  database.run("BEGIN");
  try {
    const result = fn();
    database.run("COMMIT");
    schedulePersist();
    return result;
  } catch (err) {
    try {
      database.run("ROLLBACK");
    } catch {
      /* nothing to roll back */
    }
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);
