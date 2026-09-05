import { insert, nowIso } from "../db/database";

export function logAudit(params: {
  user: string;
  action: string;
  entity?: string;
  entityId?: string | number;
  oldValue?: unknown;
  newValue?: unknown;
}): void {
  insert(
    `INSERT INTO audit_logs(user_name, action, entity, entity_id, old_value, new_value, created_at)
     VALUES(?,?,?,?,?,?,?)`,
    [
      params.user,
      params.action,
      params.entity ?? null,
      params.entityId != null ? String(params.entityId) : null,
      params.oldValue === undefined ? null : JSON.stringify(params.oldValue),
      params.newValue === undefined ? null : JSON.stringify(params.newValue),
      nowIso(),
    ],
  );
}

export interface AuditRow {
  id: number;
  user_name: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}
