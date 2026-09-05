import { all, insert, nowIso, one, run, transaction } from "../db/database";
import { computeBill } from "./gst";
import { addMovement } from "./inventory";
import { logAudit } from "./audit";
import { rawSetting, setRawSetting, getSettings } from "./settings";
import { addSupplierLedgerEntry } from "./suppliers";

export interface Purchase {
  id: number;
  purchase_number: string;
  supplier_id: number;
  supplier_name: string;
  supplier_invoice: string | null;
  purchase_date: string;
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paid: number;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  hsn: string | null;
  unit: string | null;
  qty: number;
  price: number;
  discount: number;
  gst_rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface SavePurchaseInput {
  supplierId: number;
  supplierInvoice: string;
  date: string;
  interstate?: boolean;
  lines: { productId: number; qty: number; price: number; discount: number }[];
  amountPaid: number;
  paymentMethod?: string;
  notes?: string;
  user: string;
  updateCostPrice?: boolean;
}

export function savePurchase(input: SavePurchaseInput): { id: number; number: string } {
  if (!input.lines.length) throw new Error("Add at least one product to this purchase.");
  const supplier = one<{ id: number; name: string }>(
    "SELECT id, name FROM suppliers WHERE id = ? AND active = 1",
    [input.supplierId],
  );
  if (!supplier)
    throw new Error("Unable to save this purchase because the selected supplier is not available.");

  const settings = getSettings();
  const products = input.lines.map((l) => {
    const p = one<{
      id: number;
      product_number: string;
      name: string;
      hsn: string | null;
      unit: string;
      gst_rate: number;
    }>("SELECT * FROM products WHERE id = ?", [l.productId]);
    if (!p) throw new Error("One of the products on this purchase is no longer available.");
    if (l.qty <= 0) throw new Error(`Enter a quantity for ${p.name}.`);
    return p;
  });

  const { totals, lines } = computeBill(
    input.lines.map((l, i) => ({
      qty: l.qty,
      price: l.price,
      discount: l.discount,
      gstRate: products[i]!.gst_rate,
    })),
    { interstate: !!input.interstate, roundOff: settings.roundOff },
  );

  return transaction(() => {
    const seq = Number(rawSetting("purchase_seq") ?? "0") + 1;
    setRawSetting("purchase_seq", String(seq));
    const number = `PUR-${String(seq).padStart(5, "0")}`;
    const ts = nowIso();

    const purchaseId = insert(
      `INSERT INTO purchases(purchase_number, supplier_id, supplier_name, supplier_invoice,
         purchase_date, subtotal, discount, taxable, cgst, sgst, igst, total, paid, status,
         notes, created_by, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?)`,
      [
        number,
        supplier.id,
        supplier.name,
        input.supplierInvoice || null,
        input.date,
        totals.subtotal,
        totals.discount,
        totals.taxable,
        totals.cgst,
        totals.sgst,
        totals.igst,
        totals.total,
        input.amountPaid,
        input.notes ?? null,
        input.user,
        ts,
      ],
    );

    input.lines.forEach((l, i) => {
      const p = products[i]!;
      const t = lines[i]!;
      insert(
        `INSERT INTO purchase_items(purchase_id, product_id, product_number, product_name, hsn, unit,
           qty, price, discount, gst_rate, taxable, cgst, sgst, igst, total)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          purchaseId,
          p.id,
          p.product_number,
          p.name,
          p.hsn,
          p.unit,
          l.qty,
          l.price,
          t.discount,
          p.gst_rate,
          t.taxable,
          t.cgst,
          t.sgst,
          t.igst,
          t.total,
        ],
      );
      addMovement({
        productId: p.id,
        type: "PURCHASE",
        qty: l.qty,
        refType: "PURCHASE",
        refId: purchaseId,
        refLabel: number,
        unitCost: l.price,
        user: input.user,
      });
      if (input.updateCostPrice !== false) {
        run("UPDATE products SET purchase_price = ?, updated_at = ? WHERE id = ?", [
          l.price,
          ts,
          p.id,
        ]);
      }
    });

    addSupplierLedgerEntry({
      supplierId: supplier.id,
      type: "PURCHASE",
      debit: 0,
      credit: totals.total,
      refType: "PURCHASE",
      refId: purchaseId,
      refLabel: number,
      user: input.user,
    });
    if (input.amountPaid > 0) {
      const payId = insert(
        `INSERT INTO supplier_payments(supplier_id, amount, method, reference, notes, paid_at, created_by)
         VALUES(?,?,?,?,?,?,?)`,
        [
          supplier.id,
          input.amountPaid,
          input.paymentMethod ?? "CASH",
          input.supplierInvoice ?? null,
          "Paid with purchase " + number,
          ts,
          input.user,
        ],
      );
      addSupplierLedgerEntry({
        supplierId: supplier.id,
        type: "PAYMENT",
        debit: input.amountPaid,
        credit: 0,
        refType: "PAYMENT",
        refId: payId,
        refLabel: number,
        user: input.user,
      });
    }

    logAudit({
      user: input.user,
      action: "PURCHASE_CREATED",
      entity: "purchases",
      entityId: purchaseId,
      newValue: { number, total: totals.total, supplier: supplier.name },
    });
    return { id: purchaseId, number };
  });
}

export function listPurchases(
  opts: { from?: string; to?: string; supplierId?: number; search?: string; limit?: number } = {},
): Purchase[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.from) {
    where.push("purchase_date >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("purchase_date <= ?");
    params.push(opts.to);
  }
  if (opts.supplierId) {
    where.push("supplier_id = ?");
    params.push(opts.supplierId);
  }
  if (opts.search) {
    where.push("(purchase_number LIKE ? OR supplier_invoice LIKE ? OR supplier_name LIKE ?)");
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  params.push(opts.limit ?? 100);
  return all<Purchase>(
    `SELECT * FROM purchases ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY id DESC LIMIT ?`,
    params,
  );
}

export function getPurchase(id: number) {
  const purchase = one<Purchase>("SELECT * FROM purchases WHERE id = ?", [id]);
  if (!purchase) return null;
  return {
    purchase,
    items: all<PurchaseItem>("SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY id", [id]),
  };
}

export function savePurchaseReturn(params: {
  purchaseId: number;
  lines: { purchaseItemId: number; qty: number }[];
  reason: string;
  user: string;
}): string {
  const found = getPurchase(params.purchaseId);
  if (!found) throw new Error("That purchase could not be found.");
  const active = params.lines.filter((l) => l.qty > 0);
  if (!active.length) throw new Error("Enter the quantity being returned.");

  return transaction(() => {
    const seq = Number(rawSetting("purchase_return_seq") ?? "0") + 1;
    setRawSetting("purchase_return_seq", String(seq));
    const number = `PRT-${String(seq).padStart(5, "0")}`;
    const ts = nowIso();
    let total = 0;

    for (const line of active) {
      const item = found.items.find((i) => i.id === line.purchaseItemId);
      if (!item) throw new Error("One of the returned items is not on this purchase.");
      if (line.qty > item.qty)
        throw new Error(`You cannot return more ${item.product_name} than was purchased.`);
      const taxable = Math.round((item.taxable * line.qty) / item.qty);
      const tax = Math.round(((item.cgst + item.sgst + item.igst) * line.qty) / item.qty);
      total += taxable + tax;
      addMovement({
        productId: item.product_id,
        type: "PURCHASE_RETURN",
        qty: -line.qty,
        refType: "PURCHASE_RETURN",
        refLabel: number,
        unitCost: item.price,
        notes: params.reason,
        user: params.user,
      });
    }

    addSupplierLedgerEntry({
      supplierId: found.purchase.supplier_id,
      type: "PURCHASE_RETURN",
      debit: total,
      credit: 0,
      refType: "PURCHASE_RETURN",
      refLabel: number,
      notes: params.reason,
      user: params.user,
    });
    logAudit({
      user: params.user,
      action: "PURCHASE_RETURN",
      entity: "purchases",
      entityId: params.purchaseId,
      newValue: { number, total, reason: params.reason },
    });
    run("UPDATE purchases SET notes = COALESCE(notes,'') || ? WHERE id = ?", [
      ` [Return ${number} on ${ts.slice(0, 10)}]`,
      params.purchaseId,
    ]);
    return number;
  });
}
