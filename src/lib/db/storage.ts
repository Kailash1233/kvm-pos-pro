/**
 * Where the SQLite file lives.
 *
 * In the packaged Windows desktop app the Electron preload exposes
 * window.kvmDesktop, and the database is a real .db file in the
 * user's application data folder (KVM Agencies/Database).
 *
 * Without that bridge (development preview) the same bytes are kept in
 * the local browser IndexedDB store. Nothing ever leaves the machine.
 */

export interface DesktopBridge {
  loadDb(): Promise<Uint8Array | null>;
  saveDb(bytes: Uint8Array): Promise<void>;
  backupDb(bytes: Uint8Array, name: string): Promise<string>;
  listBackups(): Promise<{ name: string; size: number; created: string }[]>;
  readBackup(name: string): Promise<Uint8Array | null>;
  openBackupFolder(): Promise<void>;
  dbPath(): Promise<string>;
  saveFile(name: string, bytes: Uint8Array): Promise<string>;
}

declare global {
  interface Window {
    kvmDesktop?: DesktopBridge;
  }
}

export function bridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : window.kvmDesktop;
}

export const isDesktop = () => !!bridge();

const IDB_NAME = "kvm-agencies";
const STORE = "files";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<Uint8Array | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as Uint8Array) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: Uint8Array): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbKeys(prefix: string): Promise<string[]> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAllKeys();
    req.onsuccess = () =>
      resolve((req.result as string[]).filter((k) => String(k).startsWith(prefix)));
    req.onerror = () => reject(req.error);
  });
}

const DB_KEY = "database/kvm.db";
const BACKUP_PREFIX = "backups/";

export async function loadDatabaseFile(): Promise<Uint8Array | null> {
  const b = bridge();
  if (b) return b.loadDb();
  return idbGet(DB_KEY);
}

export async function saveDatabaseFile(bytes: Uint8Array): Promise<void> {
  const b = bridge();
  if (b) return b.saveDb(bytes);
  return idbSet(DB_KEY, bytes);
}

export async function writeBackup(bytes: Uint8Array, name: string): Promise<string> {
  const b = bridge();
  if (b) return b.backupDb(bytes, name);
  await idbSet(BACKUP_PREFIX + name, bytes);
  return "Local app storage / Backups / " + name;
}

export async function listBackupFiles(): Promise<
  { name: string; size: number; created: string }[]
> {
  const b = bridge();
  if (b) return b.listBackups();
  const keys = await idbKeys(BACKUP_PREFIX);
  const out: { name: string; size: number; created: string }[] = [];
  for (const k of keys) {
    const data = await idbGet(k);
    out.push({
      name: k.slice(BACKUP_PREFIX.length),
      size: data?.byteLength ?? 0,
      created: k.slice(BACKUP_PREFIX.length).replace(/KVM_|\.db/g, ""),
    });
  }
  return out.sort((a, b2) => (a.name < b2.name ? 1 : -1));
}

export async function readBackupFile(name: string): Promise<Uint8Array | null> {
  const b = bridge();
  if (b) return b.readBackup(name);
  return idbGet(BACKUP_PREFIX + name);
}

export async function openBackupFolder(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  await b.openBackupFolder();
  return true;
}

export async function databaseLocation(): Promise<string> {
  const b = bridge();
  if (b) return b.dbPath();
  return "Local application storage (development preview)";
}

/** Saves an export/invoice file. Uses the desktop folders when available. */
export async function saveExportFile(name: string, bytes: Uint8Array): Promise<string> {
  const b = bridge();
  if (b) return b.saveFile(name, bytes);
  const blob = new Blob([bytes as unknown as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}
