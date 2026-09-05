import { all, insert, nowIso, one, run, schedulePersist, scalar, transaction } from "../db/database";
import { logAudit } from "./audit";

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  opening_balance: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierWithBalance extends Supplier {
  outstanding: number;
}

const BALANCE_SQL = `
  s.opening_balance
  + COALESCE((SELECT SUM(l.credit - l.debit) FROM supplier_ledger l WHERE l.supplier_id = s.id), 0)
  AS outstanding`;

export function listSuppliers(
  opts: { search?: string; includeInactive?: boolean; limit?: number } = {},
): SupplierWithBalance[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!opts.includeInactive) where.push("s.active = 1");
  if (opts.search) {
    const like = `%${opts.search.trim()}%`;
    where.push("(s.name LIKE ? OR s.phone LIKE ? OR s.gstin LIKE ?)");
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 200);
  return all<SupplierWithBalance>(
    `SELECT s.*, ${BALANCE_SQL} FROM suppliers s
     ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY s.name LIMIT ?`,
    params,
  );
}

export function getSupplier(id: number): SupplierWithBalance | null {
  return one<SupplierWithBalance>(`SELECT s.*, ${BALANCE_SQL} FROM suppliers s WHERE s.id = ?`, [id]);
}

export interface SupplierInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  opening_balance?: number;
}

export function createSupplier(input: SupplierInput, actor: string): number {
  if (!input.name.trim()) throw new Error("Please enter the supplier name.");
  const ts = nowIso();
  const id = insert(
    `INSERT INTO suppliers(name, phone, address, gstin, opening_balance, active, created_at, updated_at)
     VALUES(?,?,?,?,?,1,?,?)`,
    [
      input.name.trim(),
      input.phone || null,
      input.address || null,
      input.gstin?.trim().toUpperCase() || null,
      input.opening_balance ?? 0,
      ts,
      ts,
    ],
  );
  logAudit({
    user: actor,
    action: "SUPPLIER_CREATED",
    entity: "suppliers",
    entityId: id,
    newValue: { name: input.name },
  });
  schedulePersist();
  return id;
}

export function updateSupplier(id: number, input: SupplierInput, actor: string) {
  run(
    `UPDATE suppliers SET name=?, phone=?, address=?, gstin=?, opening_balance=?, updated_at=? WHERE id=?`,
    [
      input.name.trim(),
      input.phone || null,
      input.address || null,
      input.gstin?.trim().toUpperCase() || null,
      input.opening_balance ?? 0,
      nowIso(),
      id,
    ],
  );
  logAudit({ user: actor, action: "SUPPLIER_UPDATED", entity: "suppliers", entityId: id });
  schedulePersist();
}

export function setSupplierActive(id: number, active: boolean, actor: string) {
  run("UPDATE suppliers SET active = ?, updated_at = ? WHERE id = ?", [active ? 1 : 0, nowIso(), id]);
  logAudit({
    user: actor,
    action: active ? "SUPPLIER_ACTIVATED" : "SUPPLIER_DEACTIVATED",
    entity: "suppliers",
    entityId: id,
  });
  schedulePersist();
}

export function addSupplierLedgerEntry(e: {
  supplierId: number;
  type: string;
  debit: number;
  credit: number;
  refType?: string;
  refId?: number;
  refLabel?: string;
  notes?: string;
  user: string;
}): number {
  const ts = nowIso();
  return insert(
    `INSERT INTO supplier_ledger(supplier_id, entry_date, type, debit, credit, ref_type, ref_id,
       ref_label, notes, created_by, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [
      e.supplierId,
      ts.slice(0, 10),
      e.type,
      e.debit,
      e.credit,
      e.refType ?? null,
      e.refId ?? null,
      e.refLabel ?? null,
      e.notes ?? null,
      e.user,
      ts,
    ],
  );
}

export function supplierLedger(supplierId: number) {
  return all<{
    id: number;
    entry_date: string;
    type: string;
    debit: number;
    credit: number;
    ref_label: string | null;
    notes: string | null;
  }>("SELECT * FROM supplier_ledger WHERE supplier_id = ? ORDER BY id", [supplierId]);
}

export function paySupplier(params: {
  supplierId: number;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  user: string;
}) {
  if (params.amount <= 0) throw new Error("Please enter the amount paid.");
  transaction(() => {
    const ts = nowIso();
    const payId = insert(
      `INSERT INTO supplier_payments(supplier_id, amount, method, reference, notes, paid_at, created_by)
       VALUES(?,?,?,?,?,?,?)`,
      [
        params.supplierId,
        params.amount,
        params.method,
        params.reference ?? null,
        params.notes ?? null,
        ts,
        params.user,
      ],
    );
    addSupplierLedgerEntry({
      supplierId: params.supplierId,
      type: "PAYMENT",
      debit: params.amount,
      credit: 0,
      refType: "PAYMENT",
      refId: payId,
      refLabel: params.method,
      notes: params.notes,
      user: params.user,
    });
    logAudit({
      user: params.user,
      action: "SUPPLIER_PAYMENT",
      entity: "supplier_payments",
      entityId: payId,
      newValue: { supplierId: params.supplierId, amount: params.amount },
    });
  });
}

export function totalSupplierOutstanding(): number {
  return (
    scalar<number>(
      `SELECT COALESCE(SUM(bal),0) FROM (
         SELECT s.opening_balance +
           COALESCE((SELECT SUM(l.credit - l.debit) FROM supplier_ledger l WHERE l.supplier_id = s.id),0) AS bal
         FROM suppliers s) WHERE bal > 0`,
    ) ?? 0
  );
}
