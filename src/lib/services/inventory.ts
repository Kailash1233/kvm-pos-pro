import { all, insert, nowIso, scalar, transaction } from "../db/database";
import { logAudit } from "./audit";

export type MovementType =
  | "OPENING"
  | "PURCHASE"
  | "SALE"
  | "PURCHASE_RETURN"
  | "SALES_RETURN"
  | "ADJUST_IN"
  | "ADJUST_OUT";

export interface StockMovement {
  id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  type: MovementType;
  qty: number;
  ref_type: string | null;
  ref_id: number | null;
  ref_label: string | null;
  unit_cost: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

/** Records one stock movement. Must be called inside a transaction. */
export function addMovement(m: {
  productId: number;
  type: MovementType;
  qty: number;
  refType?: string | undefined;
  refId?: number | undefined;
  refLabel?: string | undefined;
  unitCost?: number | undefined;
  notes?: string | undefined;
  user: string;
}): number {
  return insert(
    `INSERT INTO stock_movements(product_id, type, qty, ref_type, ref_id, ref_label, unit_cost, notes, created_by, created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    [
      m.productId,
      m.type,
      m.qty,
      m.refType ?? null,
      m.refId ?? null,
      m.refLabel ?? null,
      m.unitCost ?? 0,
      m.notes ?? null,
      m.user,
      nowIso(),
    ],
  );
}

/** Current stock is always derived from the movement ledger. */
export function currentStock(productId: number): number {
  return scalar<number>("SELECT COALESCE(SUM(qty),0) FROM stock_movements WHERE product_id = ?", [
    productId,
  ]) ?? 0;
}

export function movements(
  opts: {
    productId?: number | undefined;
    from?: string | undefined;
    to?: string | undefined;
    limit?: number | undefined;
  } = {},
): StockMovement[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.productId) {
    where.push("sm.product_id = ?");
    params.push(opts.productId);
  }
  if (opts.from) {
    where.push("date(sm.created_at) >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("date(sm.created_at) <= ?");
    params.push(opts.to);
  }
  params.push(opts.limit ?? 300);
  return all<StockMovement>(
    `SELECT sm.*, p.product_number, p.name AS product_name
     FROM stock_movements sm JOIN products p ON p.id = sm.product_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY sm.id DESC LIMIT ?`,
    params,
  );
}

export function adjustStock(params: {
  productId: number;
  qty: number;
  direction: "IN" | "OUT";
  reason: string;
  notes?: string | undefined;
  user: string;
}): void {
  if (params.qty <= 0) throw new Error("Please enter a quantity greater than zero.");
  if (!params.reason) throw new Error("Please choose a reason for this stock change.");
  transaction(() => {
    const signed = params.direction === "IN" ? params.qty : -params.qty;
    const id = addMovement({
      productId: params.productId,
      type: params.direction === "IN" ? "ADJUST_IN" : "ADJUST_OUT",
      qty: signed,
      refType: "ADJUSTMENT",
      refLabel: params.reason,
      notes: params.notes,
      user: params.user,
    });
    logAudit({
      user: params.user,
      action: "STOCK_ADJUSTED",
      entity: "stock_movements",
      entityId: id,
      newValue: {
        productId: params.productId,
        qty: signed,
        reason: params.reason,
        notes: params.notes,
      },
    });
  });
}
