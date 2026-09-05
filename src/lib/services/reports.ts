import { all, scalar } from "../db/database";
import { totalCustomerOutstanding } from "./customers";
import { totalSupplierOutstanding } from "./suppliers";

export const today = () => new Date().toISOString().slice(0, 10);

export function dayOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export interface DaySummary {
  sales: number;
  bills: number;
  itemsSold: number;
  cash: number;
  upi: number;
  card: number;
  credit: number;
  other: number;
  discount: number;
  returns: number;
  customerOutstanding: number;
  supplierOutstanding: number;
}

export function daySummary(date = today()): DaySummary {
  const base = all<{ sales: number; bills: number; discount: number }>(
    `SELECT COALESCE(SUM(total),0) AS sales, COUNT(*) AS bills, COALESCE(SUM(discount),0) AS discount
     FROM sales WHERE sale_date = ? AND status = 'ACTIVE'`,
    [date],
  )[0]!;
  const items =
    scalar<number>(
      `SELECT COALESCE(SUM(si.qty),0) FROM sale_items si JOIN sales s ON s.id = si.sale_id
       WHERE s.sale_date = ? AND s.status = 'ACTIVE'`,
      [date],
    ) ?? 0;
  const pays = all<{ method: string; amount: number }>(
    `SELECT sp.method, COALESCE(SUM(sp.amount),0) AS amount FROM sale_payments sp
     JOIN sales s ON s.id = sp.sale_id
     WHERE s.sale_date = ? AND s.status = 'ACTIVE' GROUP BY sp.method`,
    [date],
  );
  const byMethod = (m: string) => pays.find((p) => p.method === m)?.amount ?? 0;
  const returns =
    scalar<number>("SELECT COALESCE(SUM(total),0) FROM sales_returns WHERE return_date = ?", [
      date,
    ]) ?? 0;
  return {
    sales: base.sales,
    bills: base.bills,
    itemsSold: items,
    cash: byMethod("CASH"),
    upi: byMethod("UPI"),
    card: byMethod("CARD"),
    credit: byMethod("CREDIT"),
    other: byMethod("OTHER"),
    discount: base.discount,
    returns,
    customerOutstanding: totalCustomerOutstanding(),
    supplierOutstanding: totalSupplierOutstanding(),
  };
}

export interface RangeFilter {
  from: string;
  to: string;
  category?: string;
  brand?: string;
  customerId?: number;
  user?: string;
}

function rangeClause(f: RangeFilter, alias = "s") {
  const where = [`${alias}.sale_date >= ?`, `${alias}.sale_date <= ?`, `${alias}.status = 'ACTIVE'`];
  const params: (string | number)[] = [f.from, f.to];
  if (f.customerId) {
    where.push(`${alias}.customer_id = ?`);
    params.push(f.customerId);
  }
  if (f.user) {
    where.push(`${alias}.created_by = ?`);
    params.push(f.user);
  }
  return { where, params };
}

export function dailySales(f: RangeFilter) {
  const { where, params } = rangeClause(f);
  return all<{ day: string; bills: number; sales: number; discount: number; tax: number }>(
    `SELECT s.sale_date AS day, COUNT(*) AS bills, COALESCE(SUM(s.total),0) AS sales,
            COALESCE(SUM(s.discount),0) AS discount,
            COALESCE(SUM(s.cgst + s.sgst + s.igst),0) AS tax
     FROM sales s WHERE ${where.join(" AND ")} GROUP BY s.sale_date ORDER BY s.sale_date DESC`,
    params,
  );
}

export function monthlySales(f: RangeFilter) {
  const { where, params } = rangeClause(f);
  return all<{ month: string; bills: number; sales: number; tax: number }>(
    `SELECT substr(s.sale_date,1,7) AS month, COUNT(*) AS bills, COALESCE(SUM(s.total),0) AS sales,
            COALESCE(SUM(s.cgst + s.sgst + s.igst),0) AS tax
     FROM sales s WHERE ${where.join(" AND ")} GROUP BY month ORDER BY month DESC`,
    params,
  );
}

export interface ProfitRow {
  label: string;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
}

function groupedSales(f: RangeFilter, groupCol: string): ProfitRow[] {
  const { where, params } = rangeClause(f);
  const extra: string[] = [];
  if (f.category) {
    extra.push("si.category = ?");
    params.push(f.category);
  }
  if (f.brand) {
    extra.push("si.brand = ?");
    params.push(f.brand);
  }
  return all<ProfitRow>(
    `SELECT COALESCE(${groupCol}, 'Not set') AS label,
            COALESCE(SUM(si.qty),0) AS qty,
            COALESCE(SUM(si.taxable),0) AS revenue,
            COALESCE(SUM(si.cost * si.qty / 1000),0) AS cost,
            COALESCE(SUM(si.taxable) - SUM(si.cost * si.qty / 1000),0) AS profit
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE ${[...where, ...extra].join(" AND ")}
     GROUP BY label ORDER BY revenue DESC`,
    params,
  );
}

export const salesByProduct = (f: RangeFilter) =>
  groupedSales(f, "si.product_number || ' - ' || si.product_name");
export const salesByCategory = (f: RangeFilter) => groupedSales(f, "si.category");
export const salesByBrand = (f: RangeFilter) => groupedSales(f, "si.brand");
export const salesByUser = (f: RangeFilter) => {
  const { where, params } = rangeClause(f);
  return all<{ label: string; bills: number; sales: number }>(
    `SELECT s.created_by AS label, COUNT(*) AS bills, COALESCE(SUM(s.total),0) AS sales
     FROM sales s WHERE ${where.join(" AND ")} GROUP BY label ORDER BY sales DESC`,
    params,
  );
};

export function paymentCollection(f: RangeFilter) {
  return all<{ method: string; amount: number; count: number }>(
    `SELECT method, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count
     FROM customer_payments WHERE date(paid_at) >= ? AND date(paid_at) <= ?
     GROUP BY method ORDER BY amount DESC`,
    [f.from, f.to],
  );
}

// ------------------------------------------------------------------- GST

export function gstSalesRegister(f: RangeFilter) {
  const { where, params } = rangeClause(f);
  return all<{
    invoice_number: string;
    sale_date: string;
    customer_name: string;
    customer_gstin: string | null;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>(
    `SELECT invoice_number, sale_date, customer_name, customer_gstin, taxable, cgst, sgst, igst, total
     FROM sales s WHERE ${where.join(" AND ")} ORDER BY s.sale_date, s.id`,
    params,
  );
}

export function gstPurchaseRegister(f: RangeFilter) {
  return all<{
    purchase_number: string;
    supplier_invoice: string | null;
    purchase_date: string;
    supplier_name: string;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>(
    `SELECT purchase_number, supplier_invoice, purchase_date, supplier_name, taxable, cgst, sgst, igst, total
     FROM purchases WHERE purchase_date >= ? AND purchase_date <= ? AND status = 'ACTIVE'
     ORDER BY purchase_date, id`,
    [f.from, f.to],
  );
}

export function hsnSummary(f: RangeFilter) {
  return all<{
    hsn: string;
    description: string;
    gst_rate: number;
    qty: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
  }>(
    `SELECT COALESCE(si.hsn,'-') AS hsn, MIN(si.product_name) AS description, si.gst_rate,
            SUM(si.qty) AS qty, SUM(si.taxable) AS taxable,
            SUM(si.cgst) AS cgst, SUM(si.sgst) AS sgst, SUM(si.igst) AS igst
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.status = 'ACTIVE'
     GROUP BY hsn, si.gst_rate ORDER BY hsn`,
    [f.from, f.to],
  );
}

export function taxSummary(f: RangeFilter) {
  return all<{
    gst_rate: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  }>(
    `SELECT si.gst_rate, SUM(si.taxable) AS taxable, SUM(si.cgst) AS cgst, SUM(si.sgst) AS sgst,
            SUM(si.igst) AS igst, SUM(si.total) AS total
     FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.sale_date >= ? AND s.sale_date <= ? AND s.status = 'ACTIVE'
     GROUP BY si.gst_rate ORDER BY si.gst_rate`,
    [f.from, f.to],
  );
}

export function cancelledBills(f: RangeFilter) {
  return all<{
    invoice_number: string;
    sale_date: string;
    customer_name: string;
    total: number;
    cancel_reason: string | null;
    cancelled_by: string | null;
    cancelled_at: string | null;
  }>(
    `SELECT invoice_number, sale_date, customer_name, total, cancel_reason, cancelled_by, cancelled_at
     FROM sales WHERE status = 'CANCELLED' AND sale_date >= ? AND sale_date <= ?
     ORDER BY sale_date DESC`,
    [f.from, f.to],
  );
}

export function stockReport(lowOnly = false) {
  return all<{
    product_number: string;
    name: string;
    category: string | null;
    brand: string | null;
    unit: string;
    stock: number;
    min_stock: number;
    purchase_price: number;
    retail_price: number;
    value: number;
  }>(
    `SELECT * FROM (
       SELECT p.product_number, p.name, p.category, p.brand, p.unit, p.min_stock,
              p.purchase_price, p.retail_price,
              COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id),0) AS stock,
              COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id),0)
                * p.purchase_price / 1000 AS value
       FROM products p WHERE p.active = 1)
     ${lowOnly ? "WHERE min_stock > 0 AND stock < min_stock" : ""}
     ORDER BY CAST(product_number AS INTEGER)`,
  );
}

export interface StockValue {
  cost: number;
  retail: number;
  items: number;
}

export function stockValue(): StockValue {
  const r = all<StockValue>(
    `SELECT COALESCE(SUM(stock * purchase_price / 1000),0) AS cost,
            COALESCE(SUM(stock * retail_price / 1000),0) AS retail,
            COUNT(*) AS items
     FROM (
       SELECT p.purchase_price, p.retail_price,
         COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id),0) AS stock
       FROM products p WHERE p.active = 1)`,
  )[0];
  return {
    cost: Math.round(r?.cost ?? 0),
    retail: Math.round(r?.retail ?? 0),
    items: r?.items ?? 0,
  };
}
