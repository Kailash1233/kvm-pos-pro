import { all, insert, nowIso, one, run, scalar, transaction } from "../db/database";
import { computeBill } from "./gst";
import { addMovement, currentStock } from "./inventory";
import { logAudit } from "./audit";
import { getSettings, rawSetting, setRawSetting } from "./settings";
import { addCustomerLedgerEntry } from "./customers";

export type PaymentMethod = "CASH" | "UPI" | "CARD" | "CREDIT" | "OTHER";

export interface BillLineInput {
  productId: number;
  qty: number;
  price: number;
  discount: number;
}

export interface BillPaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface SaveBillInput {
  customerId: number | null;
  billDiscount: number;
  lines: BillLineInput[];
  payments: BillPaymentInput[];
  notes?: string;
  user: string;
  creditApprovedBy?: string;
  /** When no explicit payment split is given, settle the whole bill this way. */
  payFull?: PaymentMethod;
}

export interface Sale {
  id: number;
  invoice_number: string;
  sale_date: string;
  customer_id: number | null;
  customer_name: string;
  customer_gstin: string | null;
  customer_type: string | null;
  interstate: number;
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  round_off: number;
  total: number;
  paid: number;
  credit_amount: number;
  status: "ACTIVE" | "CANCELLED";
  cancel_reason: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_number: string;
  product_name: string;
  category: string | null;
  brand: string | null;
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
  cost: number;
}

export interface SalePayment {
  id: number;
  sale_id: number;
  method: PaymentMethod;
  amount: number;
  reference: string | null;
  paid_at: string;
}

function financialYear(d = new Date()): string {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 4 ? String(y) : String(y - 1);
}

/** Sequential, never reused - the counter only moves forward. */
export function nextInvoiceNumber(): string {
  const s = getSettings();
  const fy = financialYear();
  const key = `invoice_seq_${fy}`;
  const current = Number(rawSetting(key) ?? "0");
  const next = current + 1;
  setRawSetting(key, String(next));
  return `${s.invoicePrefix}-${fy}-${String(next).padStart(6, "0")}`;
}

export function saveBill(input: SaveBillInput): { saleId: number; invoiceNumber: string } {
  if (!input.lines.length) throw new Error("Add at least one product before saving the bill.");

  const settings = getSettings();
  const customer = input.customerId
    ? one<{
        id: number;
        name: string;
        gstin: string | null;
        type: string;
        state_code: string | null;
      }>("SELECT id, name, gstin, type, state_code FROM customers WHERE id = ?", [input.customerId])
    : null;
  if (input.customerId && !customer)
    throw new Error("That customer is no longer available. Please choose another.");

  const interstate =
    !!customer?.state_code && !!settings.stateCode && customer.state_code !== settings.stateCode;

  const products = input.lines.map((l) => {
    const p = one<{
      id: number;
      product_number: string;
      name: string;
      category: string | null;
      brand: string | null;
      hsn: string | null;
      unit: string;
      gst_rate: number;
      purchase_price: number;
      active: number;
    }>("SELECT * FROM products WHERE id = ?", [l.productId]);
    if (!p) throw new Error("One of the products on this bill is no longer available.");
    if (l.qty <= 0) throw new Error(`Enter a quantity for ${p.name}.`);
    if (l.price < 0) throw new Error(`Enter a valid price for ${p.name}.`);
    return p;
  });

  const { totals, lines } = computeBill(
    input.lines.map((l, i) => ({
      qty: l.qty,
      price: l.price,
      discount: l.discount,
      gstRate: products[i]!.gst_rate,
    })),
    { interstate, billDiscount: input.billDiscount, roundOff: settings.roundOff },
  );

  if (!input.payments.length && input.payFull) {
    input = { ...input, payments: [{ method: input.payFull, amount: totals.total }] };
  }

  const paid = input.payments
    .filter((p) => p.method !== "CREDIT")
    .reduce((s, p) => s + p.amount, 0);
  const credit = input.payments
    .filter((p) => p.method === "CREDIT")
    .reduce((s, p) => s + p.amount, 0);

  if (credit > 0 && !customer)
    throw new Error("Credit bills need a customer. Please select the customer first.");
  if (paid + credit !== totals.total)
    throw new Error("The payment amounts do not add up to the bill total.");

  return transaction(() => {
    const invoiceNumber = nextInvoiceNumber();
    const ts = nowIso();
    const saleId = insert(
      `INSERT INTO sales(invoice_number, sale_date, customer_id, customer_name, customer_gstin,
        customer_type, interstate, subtotal, discount, taxable, cgst, sgst, igst, round_off,
        total, paid, credit_amount, status, notes, created_by, created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE', ?,?,?)`,
      [
        invoiceNumber,
        ts.slice(0, 10),
        customer?.id ?? null,
        customer?.name ?? "Walk-in Customer",
        customer?.gstin ?? null,
        customer?.type ?? "Walk-in",
        interstate ? 1 : 0,
        totals.subtotal,
        totals.discount,
        totals.taxable,
        totals.cgst,
        totals.sgst,
        totals.igst,
        totals.roundOff,
        totals.total,
        paid,
        credit,
        input.notes ?? null,
        input.user,
        ts,
      ],
    );

    input.lines.forEach((l, i) => {
      const p = products[i]!;
      const t = lines[i]!;
      insert(
        `INSERT INTO sale_items(sale_id, product_id, product_number, product_name, category, brand,
          hsn, unit, qty, price, discount, gst_rate, taxable, cgst, sgst, igst, total, cost)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          saleId,
          p.id,
          p.product_number,
          p.name,
          p.category,
          p.brand,
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
          p.purchase_price,
        ],
      );
      addMovement({
        productId: p.id,
        type: "SALE",
        qty: -l.qty,
        refType: "SALE",
        refId: saleId,
        refLabel: invoiceNumber,
        unitCost: p.purchase_price,
        user: input.user,
      });
    });

    for (const pay of input.payments) {
      if (pay.amount <= 0) continue;
      insert(
        `INSERT INTO sale_payments(sale_id, method, amount, reference, paid_at) VALUES(?,?,?,?,?)`,
        [saleId, pay.method, pay.amount, pay.reference ?? null, ts],
      );
    }

    if (credit > 0 && customer) {
      addCustomerLedgerEntry({
        customerId: customer.id,
        type: "SALE_CREDIT",
        debit: credit,
        credit: 0,
        refType: "SALE",
        refId: saleId,
        refLabel: invoiceNumber,
        user: input.user,
      });
    }

    logAudit({
      user: input.user,
      action: "BILL_CREATED",
      entity: "sales",
      entityId: saleId,
      newValue: { invoiceNumber, total: totals.total, credit },
    });
    if (input.creditApprovedBy) {
      logAudit({
        user: input.creditApprovedBy,
        action: "CREDIT_LIMIT_OVERRIDE",
        entity: "sales",
        entityId: saleId,
        newValue: { invoiceNumber, credit },
      });
    }
    return { saleId, invoiceNumber };
  });
}

export function getSale(id: number): {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
} | null {
  const sale = one<Sale>("SELECT * FROM sales WHERE id = ?", [id]);
  if (!sale) return null;
  return {
    sale,
    items: all<SaleItem>("SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id", [id]),
    payments: all<SalePayment>("SELECT * FROM sale_payments WHERE sale_id = ? ORDER BY id", [id]),
  };
}

export function findSaleByInvoice(invoiceNumber: string): Sale | null {
  return one<Sale>("SELECT * FROM sales WHERE invoice_number = ?", [invoiceNumber.trim()]);
}

export interface SaleListFilters {
  from?: string;
  to?: string;
  search?: string;
  customerId?: number;
  status?: string;
  user?: string;
  limit?: number;
  offset?: number;
}

export function listSales(f: SaleListFilters = {}): Sale[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.from) {
    where.push("sale_date >= ?");
    params.push(f.from);
  }
  if (f.to) {
    where.push("sale_date <= ?");
    params.push(f.to);
  }
  if (f.customerId) {
    where.push("customer_id = ?");
    params.push(f.customerId);
  }
  if (f.status) {
    where.push("status = ?");
    params.push(f.status);
  }
  if (f.user) {
    where.push("created_by = ?");
    params.push(f.user);
  }
  if (f.search) {
    where.push("(invoice_number LIKE ? OR customer_name LIKE ?)");
    params.push(`%${f.search}%`, `%${f.search}%`);
  }
  params.push(f.limit ?? 100, f.offset ?? 0);
  return all<Sale>(
    `SELECT * FROM sales ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY id DESC LIMIT ? OFFSET ?`,
    params,
  );
}

export function cancelBill(saleId: number, reason: string, user: string): void {
  const found = getSale(saleId);
  if (!found) throw new Error("That bill could not be found.");
  if (found.sale.status === "CANCELLED") throw new Error("This bill is already cancelled.");
  if (!reason.trim()) throw new Error("Please type the reason for cancelling this bill.");
  transaction(() => {
    run("UPDATE sales SET status='CANCELLED', cancel_reason=?, cancelled_by=?, cancelled_at=? WHERE id=?", [
      reason.trim(),
      user,
      nowIso(),
      saleId,
    ]);
    for (const item of found.items) {
      addMovement({
        productId: item.product_id,
        type: "SALES_RETURN",
        qty: item.qty,
        refType: "SALE_CANCEL",
        refId: saleId,
        refLabel: found.sale.invoice_number,
        unitCost: item.cost,
        notes: "Bill cancelled",
        user,
      });
    }
    if (found.sale.credit_amount > 0 && found.sale.customer_id) {
      addCustomerLedgerEntry({
        customerId: found.sale.customer_id,
        type: "SALE_CANCELLED",
        debit: 0,
        credit: found.sale.credit_amount,
        refType: "SALE_CANCEL",
        refId: saleId,
        refLabel: found.sale.invoice_number,
        user,
      });
    }
    logAudit({
      user,
      action: "BILL_CANCELLED",
      entity: "sales",
      entityId: saleId,
      oldValue: { invoiceNumber: found.sale.invoice_number, total: found.sale.total },
      newValue: { reason },
    });
  });
}

// ------------------------------------------------------------ sales return

export function saveSalesReturn(params: {
  saleId: number;
  reason: string;
  lines: { saleItemId: number; qty: number }[];
  user: string;
}): string {
  const found = getSale(params.saleId);
  if (!found) throw new Error("That bill could not be found.");
  const active = params.lines.filter((l) => l.qty > 0);
  if (!active.length) throw new Error("Enter the quantity being returned.");

  return transaction(() => {
    const seqKey = "return_seq";
    const seq = Number(rawSetting(seqKey) ?? "0") + 1;
    setRawSetting(seqKey, String(seq));
    const returnNumber = `RET-${String(seq).padStart(5, "0")}`;
    const ts = nowIso();
    let total = 0;

    const returnId = insert(
      `INSERT INTO sales_returns(return_number, sale_id, return_date, reason, total, created_by, created_at)
       VALUES(?,?,?,?,0,?,?)`,
      [returnNumber, params.saleId, ts.slice(0, 10), params.reason, params.user, ts],
    );

    for (const line of active) {
      const item = found.items.find((i) => i.id === line.saleItemId);
      if (!item) throw new Error("One of the returned items is not on this bill.");
      const already =
        scalar<number>(
          "SELECT COALESCE(SUM(qty),0) FROM sales_return_items WHERE sale_item_id = ?",
          [item.id],
        ) ?? 0;
      if (line.qty + already > item.qty)
        throw new Error(`You cannot return more ${item.product_name} than was sold.`);

      const unitTaxable = Math.round((item.taxable * line.qty) / item.qty);
      const unitTax = Math.round(((item.cgst + item.sgst + item.igst) * line.qty) / item.qty);
      total += unitTaxable + unitTax;
      insert(
        `INSERT INTO sales_return_items(return_id, sale_item_id, product_id, product_number,
           product_name, qty, price, gst_rate, taxable, tax, total)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
        [
          returnId,
          item.id,
          item.product_id,
          item.product_number,
          item.product_name,
          line.qty,
          item.price,
          item.gst_rate,
          unitTaxable,
          unitTax,
          unitTaxable + unitTax,
        ],
      );
      addMovement({
        productId: item.product_id,
        type: "SALES_RETURN",
        qty: line.qty,
        refType: "SALES_RETURN",
        refId: returnId,
        refLabel: returnNumber,
        unitCost: item.cost,
        user: params.user,
      });
    }

    run("UPDATE sales_returns SET total = ? WHERE id = ?", [total, returnId]);

    if (found.sale.customer_id) {
      addCustomerLedgerEntry({
        customerId: found.sale.customer_id,
        type: "SALES_RETURN",
        debit: 0,
        credit: total,
        refType: "SALES_RETURN",
        refId: returnId,
        refLabel: returnNumber,
        user: params.user,
      });
    }
    logAudit({
      user: params.user,
      action: "SALES_RETURN",
      entity: "sales_returns",
      entityId: returnId,
      newValue: { returnNumber, total, saleId: params.saleId },
    });
    return returnNumber;
  });
}

export function listReturns(limit = 100) {
  return all<{
    id: number;
    return_number: string;
    return_date: string;
    reason: string | null;
    total: number;
    invoice_number: string;
    customer_name: string;
    created_by: string;
  }>(
    `SELECT r.*, s.invoice_number, s.customer_name FROM sales_returns r
     JOIN sales s ON s.id = r.sale_id ORDER BY r.id DESC LIMIT ?`,
    [limit],
  );
}

// -------------------------------------------------------------- held bills

export function holdBill(label: string, payload: unknown, user: string): number {
  const id = insert(
    "INSERT INTO held_bills(label, payload, created_by, created_at) VALUES(?,?,?,?)",
    [label, JSON.stringify(payload), user, nowIso()],
  );
  return id;
}

export function listHeldBills() {
  return all<{ id: number; label: string; payload: string; created_by: string; created_at: string }>(
    "SELECT * FROM held_bills ORDER BY id DESC",
  );
}

export function removeHeldBill(id: number) {
  run("DELETE FROM held_bills WHERE id = ?", [id]);
}

export function stockFor(productId: number) {
  return currentStock(productId);
}
