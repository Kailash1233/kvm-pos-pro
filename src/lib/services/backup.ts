import { exportBytes, persist, replaceDatabase, scalar } from "../db/database";
import {
  databaseLocation,
  listBackupFiles,
  openBackupFolder,
  readBackupFile,
  writeBackup,
} from "../db/storage";
import { logAudit } from "./audit";
import { setSetting } from "./settings";

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}`;
}

export async function backupNow(actor: string, prefix = "KVM"): Promise<string> {
  await persist();
  const name = `${prefix}_${stamp()}.db`;
  const path = await writeBackup(exportBytes(), name);
  setSetting("lastBackup", new Date().toISOString());
  logAudit({ user: actor, action: "BACKUP_CREATED", entity: "database", newValue: { name } });
  await persist();
  return path;
}

export async function listBackups() {
  return listBackupFiles();
}

export async function restoreBackup(name: string, actor: string): Promise<void> {
  const bytes = await readBackupFile(name);
  if (!bytes || bytes.byteLength === 0)
    throw new Error("That backup file could not be read. Please choose another backup.");
  // Safety copy of the live database before anything is replaced.
  await backupNow(actor, "KVM_SAFETY");
  await replaceDatabase(bytes);
  const ok = scalar<string>("PRAGMA integrity_check");
  if (ok !== "ok") throw new Error("The restored file did not pass the database check.");
  logAudit({ user: actor, action: "BACKUP_RESTORED", entity: "database", newValue: { name } });
  await persist();
}

export async function importBackupFile(bytes: Uint8Array, actor: string): Promise<void> {
  if (!bytes || bytes.byteLength === 0) throw new Error("That file is empty.");
  await backupNow(actor, "KVM_SAFETY");
  await replaceDatabase(bytes);
  logAudit({ user: actor, action: "BACKUP_RESTORED_FILE", entity: "database" });
  await persist();
}

export async function exportDatabaseCopy(): Promise<Uint8Array> {
  await persist();
  return exportBytes();
}

export { databaseLocation, openBackupFolder };

export function integrityCheck(): string {
  return scalar<string>("PRAGMA integrity_check") ?? "unknown";
}

/**
 * Keeps 7 daily and 4 weekly backups. Old daily files beyond that
 * window are reported so Settings can show what will be removed.
 */
export async function autoBackupIfDue(actor: string, lastBackup: string): Promise<boolean> {
  const last = lastBackup ? new Date(lastBackup) : null;
  const now = new Date();
  if (last && now.getTime() - last.getTime() < 12 * 60 * 60 * 1000) return false;
  await backupNow(actor, "KVM_AUTO");
  return true;
}
