/**
 * SQLite schema for KVM Agencies.
 *
 * Money columns are INTEGER paise. Quantity columns are INTEGER milli-units.
 * Financial records are never physically deleted - they are cancelled/voided.
 */

export const SCHEMA_VERSION = 1;

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'CASHIER',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS brands (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  name   TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS units (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  product_number   TEXT NOT NULL UNIQUE,
  barcode          TEXT,
  name             TEXT NOT NULL,
  category         TEXT,
  subcategory      TEXT,
  brand            TEXT,
  unit             TEXT NOT NULL DEFAULT 'Piece',
  hsn              TEXT,
  gst_rate         REAL NOT NULL DEFAULT 18,
  purchase_price   INTEGER NOT NULL DEFAULT 0,
  retail_price     INTEGER NOT NULL DEFAULT 0,
  dealer_price     INTEGER NOT NULL DEFAULT 0,
  contractor_price INTEGER NOT NULL DEFAULT 0,
  min_stock        INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_number ON products(product_number);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode) WHERE barcode IS NOT NULL AND barcode <> '';

CREATE TABLE IF NOT EXISTS customers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  phone          TEXT,
  address        TEXT,
  gstin          TEXT,
  state_code     TEXT,
  type           TEXT NOT NULL DEFAULT 'Retail',
  credit_limit   INTEGER NOT NULL DEFAULT 0,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS suppliers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  gstin           TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  sale_date      TEXT NOT NULL,
  customer_id    INTEGER REFERENCES customers(id),
  customer_name  TEXT NOT NULL,
  customer_gstin TEXT,
  customer_type  TEXT,
  interstate     INTEGER NOT NULL DEFAULT 0,
  subtotal       INTEGER NOT NULL DEFAULT 0,
  discount       INTEGER NOT NULL DEFAULT 0,
  taxable        INTEGER NOT NULL DEFAULT 0,
  cgst           INTEGER NOT NULL DEFAULT 0,
  sgst           INTEGER NOT NULL DEFAULT 0,
  igst           INTEGER NOT NULL DEFAULT 0,
  round_off      INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL DEFAULT 0,
  paid           INTEGER NOT NULL DEFAULT 0,
  credit_amount  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'ACTIVE',
  cancel_reason  TEXT,
  cancelled_by   TEXT,
  cancelled_at   TEXT,
  notes          TEXT,
  created_by     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);

CREATE TABLE IF NOT EXISTS sale_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id        INTEGER NOT NULL REFERENCES sales(id),
  product_id     INTEGER NOT NULL REFERENCES products(id),
  product_number TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  category       TEXT,
  brand          TEXT,
  hsn            TEXT,
  unit           TEXT,
  qty            INTEGER NOT NULL,
  price          INTEGER NOT NULL,
  discount       INTEGER NOT NULL DEFAULT 0,
  gst_rate       REAL NOT NULL,
  taxable        INTEGER NOT NULL,
  cgst           INTEGER NOT NULL DEFAULT 0,
  sgst           INTEGER NOT NULL DEFAULT 0,
  igst           INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  cost           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE TABLE IF NOT EXISTS sale_payments (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id   INTEGER NOT NULL REFERENCES sales(id),
  method    TEXT NOT NULL,
  amount    INTEGER NOT NULL,
  reference TEXT,
  paid_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);

CREATE TABLE IF NOT EXISTS purchases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_number TEXT NOT NULL UNIQUE,
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_name   TEXT NOT NULL,
  supplier_invoice TEXT,
  purchase_date   TEXT NOT NULL,
  subtotal        INTEGER NOT NULL DEFAULT 0,
  discount        INTEGER NOT NULL DEFAULT 0,
  taxable         INTEGER NOT NULL DEFAULT 0,
  cgst            INTEGER NOT NULL DEFAULT 0,
  sgst            INTEGER NOT NULL DEFAULT 0,
  igst            INTEGER NOT NULL DEFAULT 0,
  total           INTEGER NOT NULL DEFAULT 0,
  paid            INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'ACTIVE',
  notes           TEXT,
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id    INTEGER NOT NULL REFERENCES purchases(id),
  product_id     INTEGER NOT NULL REFERENCES products(id),
  product_number TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  hsn            TEXT,
  unit           TEXT,
  qty            INTEGER NOT NULL,
  price          INTEGER NOT NULL,
  discount       INTEGER NOT NULL DEFAULT 0,
  gst_rate       REAL NOT NULL,
  taxable        INTEGER NOT NULL,
  cgst           INTEGER NOT NULL DEFAULT 0,
  sgst           INTEGER NOT NULL DEFAULT 0,
  igst           INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON purchase_items(purchase_id);

CREATE TABLE IF NOT EXISTS sales_returns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL UNIQUE,
  sale_id       INTEGER NOT NULL REFERENCES sales(id),
  return_date   TEXT NOT NULL,
  reason        TEXT,
  total         INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_return_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id      INTEGER NOT NULL REFERENCES sales_returns(id),
  sale_item_id   INTEGER NOT NULL REFERENCES sale_items(id),
  product_id     INTEGER NOT NULL REFERENCES products(id),
  product_number TEXT NOT NULL,
  product_name   TEXT NOT NULL,
  qty            INTEGER NOT NULL,
  price          INTEGER NOT NULL,
  gst_rate       REAL NOT NULL,
  taxable        INTEGER NOT NULL,
  tax            INTEGER NOT NULL,
  total          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  type         TEXT NOT NULL,
  qty          INTEGER NOT NULL,
  ref_type     TEXT,
  ref_id       INTEGER,
  ref_label    TEXT,
  unit_cost    INTEGER NOT NULL DEFAULT 0,
  notes        TEXT,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_created ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS customer_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  entry_date  TEXT NOT NULL,
  type        TEXT NOT NULL,
  debit       INTEGER NOT NULL DEFAULT 0,
  credit      INTEGER NOT NULL DEFAULT 0,
  ref_type    TEXT,
  ref_id      INTEGER,
  ref_label   TEXT,
  notes       TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cust_ledger ON customer_ledger(customer_id);

CREATE TABLE IF NOT EXISTS customer_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      INTEGER NOT NULL,
  method      TEXT NOT NULL,
  reference   TEXT,
  notes       TEXT,
  paid_at     TEXT NOT NULL,
  created_by  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  entry_date  TEXT NOT NULL,
  type        TEXT NOT NULL,
  debit       INTEGER NOT NULL DEFAULT 0,
  credit      INTEGER NOT NULL DEFAULT 0,
  ref_type    TEXT,
  ref_id      INTEGER,
  ref_label   TEXT,
  notes       TEXT,
  created_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_supp_ledger ON supplier_ledger(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  amount      INTEGER NOT NULL,
  method      TEXT NOT NULL,
  reference   TEXT,
  notes       TEXT,
  paid_at     TEXT NOT NULL,
  created_by  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS held_bills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name  TEXT NOT NULL,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  old_value  TEXT,
  new_value  TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`,
  },
];
