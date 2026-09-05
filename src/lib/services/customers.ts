import { all, insert, nowIso, one, run, schedulePersist, scalar, transaction } from "../db/database";
import { logAudit } from "./audit";

export type CustomerType = "Walk-in" | "Retail" | "Contractor" | "Dealer";

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  state_code: string | null;
  type: CustomerType;
  credit_limit: number;
  opening_balance: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerWithBalance extends Customer {
  outstanding: number;
}

const BALANCE_SQL = `
  c.opening_balance
  + COALESCE((SELECT SUM(l.debit - l.credit) FROM customer_ledger l WHERE l.customer_id = c.id), 0)
  AS outstanding`;

export function listCustomers(
  opts: { search?: string; includeInactive?: boolean; outstandingOnly?: boolean; limit?: number } = {},
): CustomerWithBalance[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!opts.includeInactive) where.push("c.active = 1");
  if (opts.search) {
    const like = `%${opts.search.trim()}%`;
    where.push("(c.name LIKE ? OR c.phone LIKE ? OR c.gstin LIKE ?)");
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 200);
  const rows = all<CustomerWithBalance>(
    `SELECT c.*, ${BALANCE_SQL} FROM customers c
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY c.name LIMIT ?`,
    params,
  );
  return opts.outstandingOnly ? rows.filter((r) => r.outstanding > 0) : rows;
}

export function getCustomer(id: number): CustomerWithBalance | null {
  return one<CustomerWithBalance>(`SELECT c.*, ${BALANCE_SQL} FROM customers c WHERE c.id = ?`, [id]);
}

export function customerOutstanding(id: number): number {
  return getCustomer(id)?.outstanding ?? 0;
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  state_code?: string | null;
  type: CustomerType;
  credit_limit: number;
  opening_balance?: number;
}

export function createCustomer(input: CustomerInput, actor: string): number {
  if (!input.name.trim()) throw new Error("Please enter the customer name.");
  const ts = nowIso();
  const id = insert(
    `INSERT INTO customers(name, phone, address, gstin, state_code, type, credit_limit,
       opening_balance, active, created_at, updated_at)
     VALUES(?,?,?,?,?,?,?,?,1,?,?)`,
    [
      input.name.trim(),
      input.phone || null,
      input.address || null,
      input.gstin?.trim().toUpperCase() || null,
      input.state_code || input.gstin?.trim().slice(0, 2) || null,
      input.type,
      input.credit_limit,
      input.opening_balance ?? 0,
      ts,
      ts,
    ],
  );
  logAudit({
    user: actor,
    action: "CUSTOMER_CREATED",
    entity: "customers",
    entityId: id,
    newValue: { name: input.name },
  });
  schedulePersist();
  return id;
}

export function updateCustomer(id: number, input: CustomerInput, actor: string): void {
  const before = getCustomer(id);
  run(
    `UPDATE customers SET name=?, phone=?, address=?, gstin=?, state_code=?, type=?,
       credit_limit=?, opening_balance=?, updated_at=? WHERE id=?`,
    [
      input.name.trim(),
      input.phone || null,
      input.address || null,
      input.gstin?.trim().toUpperCase() || null,
      input.state_code || input.gstin?.trim().slice(0, 2) || null,
      input.type,
      input.credit_limit,
      input.opening_balance ?? 0,
      nowIso(),
      id,
    ],
  );
  logAudit({
    user: actor,
    action: "CUSTOMER_UPDATED",
    entity: "customers",
    entityId: id,
    oldValue: before ? { name: before.name, type: before.type } : undefined,
    newValue: { name: input.name, type: input.type },
  });
  schedulePersist();
}

export function setCustomerActive(id: number, active: boolean, actor: string) {
  run("UPDATE customers SET active = ?, updated_at = ? WHERE id = ?", [active ? 1 : 0, nowIso(), id]);
  logAudit({
    user: actor,
    action: active ? "CUSTOMER_ACTIVATED" : "CUSTOMER_DEACTIVATED",
    entity: "customers",
    entityId: id,
  });
  schedulePersist();
}

// ------------------------------------------------------------------ ledger

export interface LedgerEntry {
  id: number;
  customer_id: number;
  entry_date: string;
  type: string;
  debit: number;
  credit: number;
  ref_type: string | null;
  ref_id: number | null;
  ref_label: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/** Call inside a transaction when part of a bill/payment. */
export function addCustomerLedgerEntry(e: {
  customerId: number;
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
    `INSERT INTO customer_ledger(customer_id, entry_date, type, debit, credit, ref_type, ref_id,
       ref_label, notes, created_by, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [
      e.customerId,
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

export function customerLedger(customerId: number, from?: string, to?: string): LedgerEntry[] {
  const where = ["customer_id = ?"];
  const params: (string | number)[] = [customerId];
  if (from) {
    where.push("entry_date >= ?");
    params.push(from);
  }
  if (to) {
    where.push("entry_date <= ?");
    params.push(to);
  }
  return all<LedgerEntry>(
    `SELECT * FROM customer_ledger WHERE ${where.join(" AND ")} ORDER BY id`,
    params,
  );
}

export function receivePayment(params: {
  customerId: number;
  amount: number;
  method: string;
  reference?: string;
  notes?: string;
  user: string;
}): void {
  if (params.amount <= 0) throw new Error("Please enter the amount received.");
  const customer = getCustomer(params.customerId);
  if (!customer) throw new Error("That customer is no longer available.");
  transaction(() => {
    const ts = nowIso();
    const payId = insert(
      `INSERT INTO customer_payments(customer_id, amount, method, reference, notes, paid_at, created_by)
       VALUES(?,?,?,?,?,?,?)`,
      [
        params.customerId,
        params.amount,
        params.method,
        params.reference ?? null,
        params.notes ?? null,
        ts,
        params.user,
      ],
    );
    addCustomerLedgerEntry({
      customerId: params.customerId,
      type: "PAYMENT",
      debit: 0,
      credit: params.amount,
      refType: "PAYMENT",
      refId: payId,
      refLabel: `${params.method}${params.reference ? " " + params.reference : ""}`,
      notes: params.notes,
      user: params.user,
    });
    logAudit({
      user: params.user,
      action: "CUSTOMER_PAYMENT",
      entity: "customer_payments",
      entityId: payId,
      newValue: { customerId: params.customerId, amount: params.amount, method: params.method },
    });
  });
}

export function customerPayments(customerId: number, limit = 100) {
  return all<{
    id: number;
    amount: number;
    method: string;
    reference: string | null;
    notes: string | null;
    paid_at: string;
    created_by: string;
  }>("SELECT * FROM customer_payments WHERE customer_id = ? ORDER BY id DESC LIMIT ?", [
    customerId,
    limit,
  ]);
}

export function totalCustomerOutstanding(): number {
  return (
    scalar<number>(
      `SELECT COALESCE(SUM(bal),0) FROM (
         SELECT c.opening_balance +
           COALESCE((SELECT SUM(l.debit - l.credit) FROM customer_ledger l WHERE l.customer_id = c.id),0) AS bal
         FROM customers c) WHERE bal > 0`,
    ) ?? 0
  );
}
