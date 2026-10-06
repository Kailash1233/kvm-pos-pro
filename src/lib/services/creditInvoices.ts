import { all, insert, nowIso, one, run, transaction } from "../db/database";
import { addMovement, currentStock } from "./inventory";
import { logAudit } from "./audit";

/**
 * Credit Invoice: a bill can be for more than is physically in stock. The
 * available amount is handed over and physically deducted immediately; the
 * shortfall is recorded here and tracked until a later purchase lets it be
 * delivered. billed_qty is the full committed quantity, delivered_qty is
 * everything physically handed over so far (including what was already
 * given at sale time), pending = billed_qty - delivered_qty.
 *
 * Worked example: 30 in stock, customer billed 40 -> billed_qty=40,
 * delivered_qty=30 (today's handover), status PARTIAL, pending=10. A later
 * purchase lets 10 more be delivered -> delivered_qty=40, status DELIVERED.
 */

export type CreditInvoiceStatus = "PENDING" | "PARTIAL" | "DELIVERED" | "CANCELLED";

export interface CreditInvoiceEntry {
  id: number;
  sale_id: number;
  sale_item_id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  unit: string | null;
  pricing_type: string;
  customer_id: number | null;
  customer_name: string;
  customer_phone: string;
  rate: number;
  billed_qty: number;
  delivered_qty: number;
  status: CreditInvoiceStatus;
  bill_date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreditInvoiceLogEntry {
  id: number;
  entry_id: number;
  event_type: string;
  qty: number;
  ref_type: string | null;
  ref_id: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

function recomputeStatus(billedQty: number, deliveredQty: number): CreditInvoiceStatus {
  if (deliveredQty >= billedQty) return "DELIVERED";
  if (deliveredQty > 0) return "PARTIAL";
  return "PENDING";
}

/** Total qty still owed to customers for a product, across every open entry. */
export function pendingForProduct(productId: number): number {
  const rows = all<{ pending: number }>(
    `SELECT COALESCE(SUM(billed_qty - delivered_qty), 0) AS pending FROM credit_invoice_entries
     WHERE product_id = ? AND status IN ('PENDING','PARTIAL')`,
    [productId],
  );
  return rows[0]?.pending ?? 0;
}

/** Physical stock minus whatever's already promised elsewhere - what's actually sellable now. */
export function freeStock(productId: number, physicalStock?: number): number {
  const phys = physicalStock ?? currentStock(productId);
  return phys - pendingForProduct(productId);
}

/**
 * Records the shortfall for one bill line. Must be called inside the same
 * transaction as the sale that created it. `deliveredNow` is what was
 * already physically handed over at sale time (not 0 - see the worked
 * example above).
 */
export function createCreditInvoiceEntry(params: {
  saleId: number;
  saleItemId: number;
  productId: number;
  productNumber: string;
  productName: string;
  unit: string | null;
  pricingType: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  rate: number;
  billedQty: number;
  deliveredNow: number;
  billDate: string;
  user: string;
}): number {
  const ts = nowIso();
  const status = recomputeStatus(params.billedQty, params.deliveredNow);
  const id = insert(
    `INSERT INTO credit_invoice_entries(sale_id, sale_item_id, product_id, product_number,
      product_name, unit, pricing_type, customer_id, customer_name, customer_phone, rate,
      billed_qty, delivered_qty, status, bill_date, created_by, created_at, updated_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      params.saleId,
      params.saleItemId,
      params.productId,
      params.productNumber,
      params.productName,
      params.unit,
      params.pricingType,
      params.customerId,
      params.customerName,
      params.customerPhone,
      params.rate,
      params.billedQty,
      params.deliveredNow,
      status,
      params.billDate,
      params.user,
      ts,
      ts,
    ],
  );
  insert(
    `INSERT INTO credit_invoice_log(entry_id, event_type, qty, ref_type, ref_id, created_by, created_at)
     VALUES(?, 'CREATED', ?, 'SALE', ?, ?, ?)`,
    [id, params.billedQty, params.saleId, params.user, ts],
  );
  return id;
}

export function getCreditInvoiceEntry(id: number): CreditInvoiceEntry | null {
  return one<CreditInvoiceEntry>("SELECT * FROM credit_invoice_entries WHERE id = ?", [id]);
}

export function creditInvoiceLog(entryId: number): CreditInvoiceLogEntry[] {
  return all<CreditInvoiceLogEntry>(
    "SELECT * FROM credit_invoice_log WHERE entry_id = ? ORDER BY id",
    [entryId],
  );
}

export interface CreditInvoiceFilters {
  /** "OPEN" = PENDING or PARTIAL (the default "still owed" view). */
  status?: CreditInvoiceStatus | "OPEN";
  customerId?: number;
  productId?: number;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export interface CreditInvoiceListRow extends CreditInvoiceEntry {
  invoice_number: string;
}

/** Always ordered oldest bill first, so "allocate oldest first" is the natural default. */
export function listCreditInvoiceEntries(f: CreditInvoiceFilters = {}): CreditInvoiceListRow[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status === "OPEN") {
    where.push("e.status IN ('PENDING','PARTIAL')");
  } else if (f.status) {
    where.push("e.status = ?");
    params.push(f.status);
  }
  if (f.customerId) {
    where.push("e.customer_id = ?");
    params.push(f.customerId);
  }
  if (f.productId) {
    where.push("e.product_id = ?");
    params.push(f.productId);
  }
  if (f.from) {
    where.push("e.bill_date >= ?");
    params.push(f.from);
  }
  if (f.to) {
    where.push("e.bill_date <= ?");
    params.push(f.to);
  }
  if (f.search) {
    const like = `%${f.search}%`;
    where.push("(e.customer_name LIKE ? OR e.product_name LIKE ? OR s.invoice_number LIKE ?)");
    params.push(like, like, like);
  }
  params.push(f.limit ?? 200);
  return all<CreditInvoiceListRow>(
    `SELECT e.*, s.invoice_number FROM credit_invoice_entries e
     JOIN sales s ON s.id = e.sale_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY e.bill_date, e.id
     LIMIT ?`,
    params,
  );
}

export interface CreditInvoiceProductSummary {
  product_id: number;
  product_name: string;
  unit: string | null;
  pending_qty: number;
  customers: number;
}

export function creditInvoiceSummaryByProduct(): CreditInvoiceProductSummary[] {
  return all<CreditInvoiceProductSummary>(
    `SELECT product_id, product_name, unit, SUM(billed_qty - delivered_qty) AS pending_qty,
       COUNT(DISTINCT customer_name) AS customers
     FROM credit_invoice_entries
     WHERE status IN ('PENDING','PARTIAL')
     GROUP BY product_id
     ORDER BY pending_qty DESC`,
  );
}

/** What's still owed from one specific bill right now - for the printed "Pending Delivery" section. */
export function pendingDeliveriesForSale(
  saleId: number,
): { product_name: string; unit: string | null; pending_qty: number }[] {
  return all<{ product_name: string; unit: string | null; pending_qty: number }>(
    `SELECT product_name, unit, (billed_qty - delivered_qty) AS pending_qty
     FROM credit_invoice_entries
     WHERE sale_id = ? AND status IN ('PENDING','PARTIAL')`,
    [saleId],
  );
}

export function pendingDeliverySummary(pendingDays: number): { total: number; overdue: number } {
  const rows = all<{ bill_date: string }>(
    "SELECT bill_date FROM credit_invoice_entries WHERE status IN ('PENDING','PARTIAL')",
  );
  const cutoff = Date.now() - pendingDays * 86400000;
  let overdue = 0;
  for (const r of rows) if (new Date(r.bill_date).getTime() < cutoff) overdue++;
  return { total: rows.length, overdue };
}

/**
 * Delivers (or allocates) qty against a pending entry - the single
 * mechanism behind both the manual "Mark Delivered" action and the
 * post-purchase allocation prompt. They differ only in refType/refId, which
 * the history log keeps so each entry's full story stays visible.
 */
export function deliverCreditInvoice(
  entryId: number,
  qty: number,
  opts: { refType: "PURCHASE" | "MANUAL"; refId?: number; user: string; notes?: string },
): void {
  if (qty <= 0) throw new Error("Enter the quantity being delivered.");
  const entry = getCreditInvoiceEntry(entryId);
  if (!entry) throw new Error("That Credit Invoice entry could not be found.");
  if (entry.status === "CANCELLED") throw new Error("This entry was cancelled.");
  const pending = entry.billed_qty - entry.delivered_qty;
  if (qty > pending) throw new Error("That is more than is still pending for this entry.");
  const stock = currentStock(entry.product_id);
  if (qty > stock) throw new Error("There is not enough stock on hand to deliver that much.");

  transaction(() => {
    const deliveredQty = entry.delivered_qty + qty;
    const status = recomputeStatus(entry.billed_qty, deliveredQty);
    const ts = nowIso();
    run(
      "UPDATE credit_invoice_entries SET delivered_qty = ?, status = ?, updated_at = ? WHERE id = ?",
      [deliveredQty, status, ts, entryId],
    );
    addMovement({
      productId: entry.product_id,
      type: "CREDIT_DELIVERY",
      qty: -qty,
      refType: opts.refType,
      refId: opts.refId ?? entryId,
      refLabel: `Credit Invoice #${entryId}`,
      user: opts.user,
      notes: opts.notes,
    });
    insert(
      `INSERT INTO credit_invoice_log(entry_id, event_type, qty, ref_type, ref_id, notes, created_by, created_at)
       VALUES(?, 'DELIVERED', ?, ?, ?, ?, ?, ?)`,
      [entryId, qty, opts.refType, opts.refId ?? null, opts.notes ?? null, opts.user, ts],
    );
    logAudit({
      user: opts.user,
      action: "CREDIT_INVOICE_DELIVERED",
      entity: "credit_invoice_entries",
      entityId: entryId,
      newValue: { qty, refType: opts.refType, refId: opts.refId },
    });
  });
}

/**
 * Cancels every still-open entry tied to a sale, reversing only what was
 * actually delivered under it (never the full original line qty, since the
 * shortfall itself was never physically deducted) - called from cancelBill().
 */
export function cancelCreditInvoicesForSale(saleId: number, user: string): void {
  const entries = all<CreditInvoiceEntry>(
    "SELECT * FROM credit_invoice_entries WHERE sale_id = ? AND status != 'CANCELLED'",
    [saleId],
  );
  for (const entry of entries) {
    const ts = nowIso();
    run("UPDATE credit_invoice_entries SET status = 'CANCELLED', updated_at = ? WHERE id = ?", [
      ts,
      entry.id,
    ]);
    insert(
      `INSERT INTO credit_invoice_log(entry_id, event_type, qty, ref_type, ref_id, created_by, created_at)
       VALUES(?, 'CANCELLED', ?, 'SALE_CANCEL', ?, ?, ?)`,
      [entry.id, entry.delivered_qty, saleId, user, ts],
    );
  }
}

/**
 * Shrinks a pending entry's billed/delivered qty together when the
 * delivered portion of its line is returned - called from saveSalesReturn().
 * A return can never exceed what was actually delivered.
 */
export function adjustCreditInvoiceForReturn(
  saleItemId: number,
  returnedQty: number,
  user: string,
): void {
  const entry = one<CreditInvoiceEntry>(
    "SELECT * FROM credit_invoice_entries WHERE sale_item_id = ? AND status != 'CANCELLED'",
    [saleItemId],
  );
  if (!entry) return;
  if (returnedQty > entry.delivered_qty)
    throw new Error("You cannot return more of this item than has actually been delivered.");
  const ts = nowIso();
  const billedQty = entry.billed_qty - returnedQty;
  const deliveredQty = entry.delivered_qty - returnedQty;
  const status = recomputeStatus(billedQty, deliveredQty);
  run(
    "UPDATE credit_invoice_entries SET billed_qty = ?, delivered_qty = ?, status = ?, updated_at = ? WHERE id = ?",
    [billedQty, deliveredQty, status, ts, entry.id],
  );
  insert(
    `INSERT INTO credit_invoice_log(entry_id, event_type, qty, ref_type, created_by, created_at)
     VALUES(?, 'QTY_ADJUSTED', ?, 'SALES_RETURN', ?, ?)`,
    [entry.id, -returnedQty, user, ts],
  );
}
