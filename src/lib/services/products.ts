import { all, insert, nowIso, one, run, schedulePersist, scalar, transaction } from "../db/database";
import { logAudit } from "./audit";

export interface Product {
  id: number;
  product_number: string;
  barcode: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  brand: string | null;
  unit: string;
  hsn: string | null;
  gst_rate: number;
  purchase_price: number;
  retail_price: number;
  dealer_price: number;
  contractor_price: number;
  min_stock: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithStock extends Product {
  stock: number;
}

export type CustomerType = "Walk-in" | "Retail" | "Contractor" | "Dealer";

export function priceForCustomerType(p: Product, type: CustomerType | null | undefined): number {
  if (type === "Dealer" && p.dealer_price > 0) return p.dealer_price;
  if (type === "Contractor" && p.contractor_price > 0) return p.contractor_price;
  return p.retail_price;
}

const STOCK_SQL = `
  COALESCE((SELECT SUM(sm.qty) FROM stock_movements sm WHERE sm.product_id = p.id), 0) AS stock`;

export function getProduct(id: number): ProductWithStock | null {
  return one<ProductWithStock>(`SELECT p.*, ${STOCK_SQL} FROM products p WHERE p.id = ?`, [id]);
}

export function getProductByNumber(num: string): ProductWithStock | null {
  return one<ProductWithStock>(
    `SELECT p.*, ${STOCK_SQL} FROM products p WHERE p.product_number = ?`,
    [num.trim()],
  );
}

/** Fast, index-backed search across number / barcode / name / brand / HSN. */
export function searchProducts(
  term: string,
  opts: { limit?: number; includeInactive?: boolean } = {},
): ProductWithStock[] {
  const t = term.trim();
  const limit = opts.limit ?? 25;
  const activeClause = opts.includeInactive ? "" : " AND p.active = 1";
  if (!t) {
    return all<ProductWithStock>(
      `SELECT p.*, ${STOCK_SQL} FROM products p WHERE 1=1${activeClause}
       ORDER BY CAST(p.product_number AS INTEGER), p.product_number LIMIT ?`,
      [limit],
    );
  }
  const like = `%${t}%`;
  return all<ProductWithStock>(
    `SELECT p.*, ${STOCK_SQL} FROM products p
     WHERE (p.product_number = ? OR p.barcode = ? OR p.product_number LIKE ?
            OR p.name LIKE ? OR p.brand LIKE ? OR p.category LIKE ? OR p.hsn LIKE ?)
       ${activeClause}
     ORDER BY
       CASE WHEN p.product_number = ? THEN 0
            WHEN p.barcode = ? THEN 0
            WHEN p.product_number LIKE ? THEN 1
            WHEN p.name LIKE ? THEN 2
            ELSE 3 END,
       CAST(p.product_number AS INTEGER)
     LIMIT ?`,
    [t, t, `${t}%`, like, like, like, like, t, t, `${t}%`, `${t}%`, limit],
  );
}

export function listProducts(
  opts: {
    search?: string;
    category?: string;
    brand?: string;
    lowStockOnly?: boolean;
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): ProductWithStock[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (!opts.includeInactive) where.push("p.active = 1");
  if (opts.search) {
    const like = `%${opts.search.trim()}%`;
    where.push(
      "(p.product_number LIKE ? OR p.name LIKE ? OR p.brand LIKE ? OR p.barcode = ? OR p.hsn LIKE ?)",
    );
    params.push(like, like, like, opts.search.trim(), like);
  }
  if (opts.category) {
    where.push("p.category = ?");
    params.push(opts.category);
  }
  if (opts.brand) {
    where.push("p.brand = ?");
    params.push(opts.brand);
  }
  const having = opts.lowStockOnly ? " AND stock < p.min_stock" : "";
  const sql = `SELECT * FROM (SELECT p.*, ${STOCK_SQL} FROM products p
      ${where.length ? "WHERE " + where.join(" AND ") : ""})
    WHERE 1=1 ${having}
    ORDER BY CAST(product_number AS INTEGER), product_number
    LIMIT ? OFFSET ?`;
  params.push(opts.limit ?? 200, opts.offset ?? 0);
  return all<ProductWithStock>(sql, params);
}

export function countProducts(includeInactive = false): number {
  return (
    scalar<number>(
      `SELECT COUNT(*) FROM products ${includeInactive ? "" : "WHERE active = 1"}`,
    ) ?? 0
  );
}

export function lowStockProducts(limit = 100): ProductWithStock[] {
  return all<ProductWithStock>(
    `SELECT * FROM (SELECT p.*, ${STOCK_SQL} FROM products p WHERE p.active = 1)
     WHERE min_stock > 0 AND stock < min_stock
     ORDER BY (stock - min_stock) LIMIT ?`,
    [limit],
  );
}

export function nextProductNumber(category?: string): string {
  const ranges: Record<string, number> = {
    Cement: 100,
    Plumbing: 200,
    Steel: 300,
    Paint: 400,
    Electrical: 500,
    Hardware: 600,
    Sanitary: 700,
  };
  const start = category && ranges[category] ? ranges[category]! : 800;
  const used = all<{ n: number }>(
    "SELECT CAST(product_number AS INTEGER) AS n FROM products WHERE CAST(product_number AS INTEGER) BETWEEN ? AND ? ORDER BY n",
    [start, start + 99],
  ).map((r) => r.n);
  for (let i = start; i < start + 100; i++) if (!used.includes(i)) return String(i);
  const max = scalar<number>("SELECT MAX(CAST(product_number AS INTEGER)) FROM products") ?? 0;
  return String(max + 1);
}

export interface ProductInput {
  product_number: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  unit?: string;
  hsn?: string | null;
  barcode?: string | null;
  gst_rate: number;
  purchase_price: number;
  retail_price: number;
  dealer_price?: number;
  contractor_price?: number;
  min_stock?: number;
}

export function createProduct(
  input: ProductInput,
  opts: { openingStock?: number; actor: string },
): number {
  const num = input.product_number.trim();
  if (!num) throw new Error("Please enter a product number.");
  if (!input.name.trim()) throw new Error("Please enter a product name.");
  if (one("SELECT id FROM products WHERE product_number = ?", [num]))
    throw new Error(`Product number ${num} is already used by another product.`);
  if (input.barcode && one("SELECT id FROM products WHERE barcode = ?", [input.barcode.trim()]))
    throw new Error("That barcode already belongs to another product.");

  return transaction(() => {
    const ts = nowIso();
    const id = insert(
      `INSERT INTO products(product_number, barcode, name, category, subcategory, brand, unit, hsn,
        gst_rate, purchase_price, retail_price, dealer_price, contractor_price, min_stock,
        active, created_at, updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [
        num,
        input.barcode?.trim() || null,
        input.name.trim(),
        input.category || null,
        input.subcategory || null,
        input.brand || null,
        input.unit || "Piece",
        input.hsn || null,
        input.gst_rate,
        input.purchase_price,
        input.retail_price,
        input.dealer_price ?? 0,
        input.contractor_price ?? 0,
        input.min_stock ?? 0,
        ts,
        ts,
      ],
    );
    if (opts.openingStock && opts.openingStock !== 0) {
      insert(
        `INSERT INTO stock_movements(product_id, type, qty, ref_type, ref_label, unit_cost, notes, created_by, created_at)
         VALUES(?,'OPENING',?, 'OPENING', 'Opening stock', ?, NULL, ?, ?)`,
        [id, opts.openingStock, input.purchase_price, opts.actor, ts],
      );
    }
    ensureLookup("categories", input.category);
    ensureLookup("brands", input.brand);
    logAudit({
      user: opts.actor,
      action: "PRODUCT_CREATED",
      entity: "products",
      entityId: id,
      newValue: { number: num, name: input.name },
    });
    return id;
  });
}

export function updateProduct(id: number, input: ProductInput, actor: string): void {
  const before = getProduct(id);
  if (!before) throw new Error("That product could not be found.");
  const num = input.product_number.trim();
  const clash = one<{ id: number }>("SELECT id FROM products WHERE product_number = ? AND id <> ?", [
    num,
    id,
  ]);
  if (clash) throw new Error(`Product number ${num} is already used by another product.`);
  transaction(() => {
    run(
      `UPDATE products SET product_number=?, barcode=?, name=?, category=?, subcategory=?, brand=?,
         unit=?, hsn=?, gst_rate=?, purchase_price=?, retail_price=?, dealer_price=?,
         contractor_price=?, min_stock=?, updated_at=? WHERE id=?`,
      [
        num,
        input.barcode?.trim() || null,
        input.name.trim(),
        input.category || null,
        input.subcategory || null,
        input.brand || null,
        input.unit || "Piece",
        input.hsn || null,
        input.gst_rate,
        input.purchase_price,
        input.retail_price,
        input.dealer_price ?? 0,
        input.contractor_price ?? 0,
        input.min_stock ?? 0,
        nowIso(),
        id,
      ],
    );
    ensureLookup("categories", input.category);
    ensureLookup("brands", input.brand);
    logAudit({
      user: actor,
      action: "PRODUCT_UPDATED",
      entity: "products",
      entityId: id,
      oldValue: {
        number: before.product_number,
        name: before.name,
        retail: before.retail_price,
        purchase: before.purchase_price,
        gst: before.gst_rate,
      },
      newValue: {
        number: num,
        name: input.name,
        retail: input.retail_price,
        purchase: input.purchase_price,
        gst: input.gst_rate,
      },
    });
  });
}

export function setProductActive(id: number, active: boolean, actor: string) {
  run("UPDATE products SET active = ?, updated_at = ? WHERE id = ?", [
    active ? 1 : 0,
    nowIso(),
    id,
  ]);
  logAudit({
    user: actor,
    action: active ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
    entity: "products",
    entityId: id,
  });
  schedulePersist();
}

export function updatePrices(
  id: number,
  prices: {
    retail_price?: number;
    purchase_price?: number;
    dealer_price?: number;
    contractor_price?: number;
  },
  actor: string,
) {
  const before = getProduct(id);
  if (!before) throw new Error("That product could not be found.");
  const next = {
    retail_price: prices.retail_price ?? before.retail_price,
    purchase_price: prices.purchase_price ?? before.purchase_price,
    dealer_price: prices.dealer_price ?? before.dealer_price,
    contractor_price: prices.contractor_price ?? before.contractor_price,
  };
  transaction(() => {
    run(
      `UPDATE products SET retail_price=?, purchase_price=?, dealer_price=?, contractor_price=?, updated_at=? WHERE id=?`,
      [
        next.retail_price,
        next.purchase_price,
        next.dealer_price,
        next.contractor_price,
        nowIso(),
        id,
      ],
    );
    logAudit({
      user: actor,
      action: "PRICE_CHANGED",
      entity: "products",
      entityId: id,
      oldValue: {
        retail: before.retail_price,
        purchase: before.purchase_price,
        dealer: before.dealer_price,
        contractor: before.contractor_price,
      },
      newValue: next,
    });
  });
}

export function bulkPriceUpdate(
  params: {
    productIds: number[];
    field: "retail_price" | "purchase_price" | "dealer_price" | "contractor_price";
    percent: number;
  },
  actor: string,
) {
  transaction(() => {
    for (const id of params.productIds) {
      const p = getProduct(id);
      if (!p) continue;
      const oldValue = p[params.field];
      const newValue = Math.round(oldValue * (1 + params.percent / 100));
      run(`UPDATE products SET ${params.field} = ?, updated_at = ? WHERE id = ?`, [
        newValue,
        nowIso(),
        id,
      ]);
      logAudit({
        user: actor,
        action: "PRICE_CHANGED_BULK",
        entity: "products",
        entityId: id,
        oldValue: { [params.field]: oldValue },
        newValue: { [params.field]: newValue },
      });
    }
  });
}

// ------------------------------------------------------------- lookups

export function ensureLookup(table: "categories" | "brands", name?: string | null) {
  const n = name?.trim();
  if (!n) return;
  run(`INSERT OR IGNORE INTO ${table}(name, active) VALUES(?, 1)`, [n]);
}

export function listCategories(): string[] {
  return all<{ name: string }>("SELECT name FROM categories ORDER BY name").map((r) => r.name);
}

export function listBrands(): string[] {
  return all<{ name: string }>("SELECT name FROM brands ORDER BY name").map((r) => r.name);
}

export function listUnits(): string[] {
  const rows = all<{ name: string }>("SELECT name FROM units ORDER BY name").map((r) => r.name);
  return rows.length ? rows : ["Bag", "Piece", "Kg", "Ton", "Metre", "Litre", "Box", "Number"];
}
