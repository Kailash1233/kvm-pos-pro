import { all, insert, nowIso, one, run, schedulePersist } from "../db/database";
import { logAudit } from "./audit";

export type Role = "OWNER" | "MANAGER" | "CASHIER";

export interface AppUser {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  active: number;
}

interface UserRow extends AppUser {
  password_hash: string;
  password_salt: string;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return toHex(a.buffer);
}

/** PBKDF2-SHA256. Runs entirely in the local machine, no network. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function createUser(params: {
  username: string;
  fullName: string;
  role: Role;
  password: string;
  actor?: string;
}): Promise<number> {
  const salt = randomSalt();
  const hash = await hashPassword(params.password, salt);
  const ts = nowIso();
  const existing = one("SELECT id FROM users WHERE lower(username) = lower(?)", [params.username]);
  if (existing) throw new Error("That username is already in use. Please choose another.");
  const id = insert(
    `INSERT INTO users(username, full_name, role, password_hash, password_salt, active, created_at, updated_at)
     VALUES(?,?,?,?,?,1,?,?)`,
    [params.username.trim(), params.fullName.trim(), params.role, hash, salt, ts, ts],
  );
  logAudit({
    user: params.actor ?? params.fullName,
    action: "USER_CREATED",
    entity: "users",
    entityId: id,
    newValue: { username: params.username, role: params.role },
  });
  schedulePersist();
  return id;
}

export async function login(username: string, password: string): Promise<AppUser> {
  const row = one<UserRow>("SELECT * FROM users WHERE lower(username) = lower(?) AND active = 1", [
    username.trim(),
  ]);
  if (!row) throw new Error("No active user with that username.");
  const hash = await hashPassword(password, row.password_salt);
  if (hash !== row.password_hash) throw new Error("Incorrect password. Please try again.");
  logAudit({ user: row.full_name, action: "LOGIN", entity: "users", entityId: row.id });
  return { id: row.id, username: row.username, full_name: row.full_name, role: row.role, active: 1 };
}

export function listUsers(): AppUser[] {
  return all<AppUser>("SELECT id, username, full_name, role, active FROM users ORDER BY id");
}

export function userCount(): number {
  return all<{ c: number }>("SELECT COUNT(*) AS c FROM users")[0]?.c ?? 0;
}

export async function changePassword(userId: number, newPassword: string, actor: string) {
  const salt = randomSalt();
  const hash = await hashPassword(newPassword, salt);
  run("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?", [
    hash,
    salt,
    nowIso(),
    userId,
  ]);
  logAudit({ user: actor, action: "PASSWORD_CHANGED", entity: "users", entityId: userId });
  schedulePersist();
}

export function setUserActive(userId: number, active: boolean, actor: string) {
  run("UPDATE users SET active = ?, updated_at = ? WHERE id = ?", [
    active ? 1 : 0,
    nowIso(),
    userId,
  ]);
  logAudit({
    user: actor,
    action: active ? "USER_ENABLED" : "USER_DISABLED",
    entity: "users",
    entityId: userId,
  });
  schedulePersist();
}

// ------------------------------------------------------------- permissions

export type Permission =
  | "bill.create"
  | "bill.cancel"
  | "product.create"
  | "product.edit"
  | "price.edit"
  | "purchase.price.view"
  | "profit.view"
  | "stock.adjust"
  | "purchase.manage"
  | "customer.manage"
  | "supplier.manage"
  | "reports.view"
  | "gst.manage"
  | "users.manage"
  | "backup.restore"
  | "settings.manage"
  | "credit.override"
  | "import.products";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "bill.create",
    "bill.cancel",
    "product.create",
    "product.edit",
    "price.edit",
    "purchase.price.view",
    "profit.view",
    "stock.adjust",
    "purchase.manage",
    "customer.manage",
    "supplier.manage",
    "reports.view",
    "gst.manage",
    "users.manage",
    "backup.restore",
    "settings.manage",
    "credit.override",
    "import.products",
  ],
  MANAGER: [
    "bill.create",
    "bill.cancel",
    "product.create",
    "product.edit",
    "price.edit",
    "purchase.price.view",
    "profit.view",
    "stock.adjust",
    "purchase.manage",
    "customer.manage",
    "supplier.manage",
    "reports.view",
    "credit.override",
    "import.products",
    "settings.manage",
  ],
  CASHIER: ["bill.create", "customer.manage"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Maximum bill discount percentage allowed without approval. */
export function maxDiscountPercent(role: Role | undefined): number {
  if (role === "OWNER") return 100;
  if (role === "MANAGER") return 10;
  return 2;
}
