# KVM Agencies — Database & Data Model

This document explains how KVM Agencies stores data: the physical file, the
schema, the money/quantity conventions, and the accounting principles the
whole application is built around. It is aimed at a developer picking up
this codebase, not at shop staff (see `SOP.md` for that).

## 1. It's a real, local, single-file database

KVM Agencies uses **SQLite** — the entire business's data (products, bills,
customers, stock, everything) lives in **one file**, `kvm.db`. There is no
database server, no network connection, and no cloud account involved at
any point.

The same application code runs in two contexts:

| Context | How the SQLite engine runs | Where the file lives |
|---|---|---|
| Web preview (Lovable) | [sql.js](https://sql.js.org) — SQLite compiled to WebAssembly, running in the browser tab | Serialized and stored in the browser's IndexedDB |
| Installed Windows desktop app | The same sql.js WASM engine, running inside the Electron window | A real file on disk: `%APPDATA%\KVM Agencies\Database\kvm.db` |

This is possible because `src/lib/db/storage.ts` defines a small
`DesktopBridge` interface (`loadDb`, `saveDb`, `backupDb`, `listBackups`,
`readBackup`, `openBackupFolder`, `dbPath`, `saveFile`). In the browser these
calls fall back to IndexedDB; when running inside Electron, `preload.cjs`
exposes `window.kvmDesktop`, implemented in `electron/main.cjs` using plain
Node `fs`. **No application or business-logic code needs to know which
environment it's running in.**

Every write goes through `src/lib/db/database.ts`, which keeps the whole
`sql.js` database as an in-memory buffer, executes SQL against it, and
debounces a full re-serialize + save to disk (`schedulePersist`, 400ms)
so rapid typing doesn't thrash the disk. A `transaction()` helper wraps
related writes in `BEGIN`/`COMMIT`/`ROLLBACK` so a bill, a purchase, or a
payment is always saved completely or not at all (see §5).

## 2. Money and quantities are integers — never floats

Every money column is an **integer number of paise** (1 rupee = 100 paise).
Every quantity column is an **integer number of milli-units** (1 unit =
1000, so 2.5 bags is stored as `2500`). This is enforced everywhere through
`src/lib/money.ts` (`toPaise`, `toRupees`, `toQty`, `fromQty`, `rupees()`,
`formatQty()`).

This is not a style preference — it's what keeps GST and running-balance
arithmetic exact. Floating point rupees (`10.1 + 10.2 = 20.299999999999997`)
are exactly the kind of bug that corrupts an accounting system over
thousands of bills; storing paise as integers makes that class of bug
impossible.

## 3. Schema (`src/lib/db/schema.ts`)

The schema is a list of numbered migrations (`MIGRATIONS`), applied in order
against SQLite's `PRAGMA user_version` on every startup (`migrate()` in
`database.ts`). Adding a table or column later means appending a new
migration entry — existing installs upgrade automatically the next time
they open the app; nothing is ever dropped or rewritten in place.

### Core tables

| Table | Purpose |
|---|---|
| `settings` | Key/value store for business settings (name, GSTIN, invoice prefix, print format, sequence counters, `setupComplete`, `lastBackup`, …) |
| `users` | Staff accounts. `password_hash`/`password_salt` (PBKDF2-SHA256, 120,000 iterations) — never plaintext. `role` is `OWNER`/`MANAGER`/`CASHIER`. |
| `categories`, `brands`, `units` | Simple lookup lists, auto-populated as products are created/imported |
| `products` | The item master. `product_number` (human-facing, e.g. `101`) is UNIQUE and is *not* the primary key — `id` is the immutable internal key products are always referenced by. `barcode` is UNIQUE when present. |
| `customers` | `type` (`Walk-in`/`Retail`/`Contractor`/`Dealer`) drives default pricing. `credit_limit`, `opening_balance`. |
| `customer_ledger` | Every debit/credit event for a customer (sale on credit, payment received, return, cancellation reversal). This *is* the outstanding balance — see §6. |
| `customer_payments` | One row per payment collected from a customer (method, reference, notes). |
| `suppliers`, `supplier_ledger`, `supplier_payments` | Same shape as the customer side, for money owed *to* suppliers. |
| `sales` | One row per bill/invoice. Stores the *snapshot* totals (subtotal, discount, taxable, CGST/SGST/IGST, round-off, total, paid, credit_amount) and `status` (`ACTIVE`/`CANCELLED`). |
| `sale_items` | One row per line on a bill. Stores a full snapshot of the product at the time of sale — name, category, brand, HSN, unit, price, **and the GST rate used**, plus `cost` (the product's purchase price at that moment, for gross-profit reporting). |
| `sale_payments` | One row per payment method used on a bill (supports split payments — cash + UPI + credit on one invoice). |
| `sales_returns`, `sales_return_items` | A sales return against a specific `sale_item_id`; can never exceed the quantity originally sold (checked in `sales.ts`, summed against prior partial returns). |
| `purchases`, `purchase_items` | Mirrors `sales`/`sale_items` for stock coming in from a supplier. |
| `purchase_returns` (recorded as ledger + stock movement, not a separate item table) | See `savePurchaseReturn` in `purchases.ts`. |
| `stock_movements` | **The single source of truth for stock** — see §6. |
| `held_bills` | Cashier "hold this bill, serve someone else" — a JSON payload of the in-progress cart, resumed later and deleted. |
| `audit_logs` | Append-only log of sensitive actions (see §7). |

### Indexes

Every column the app searches or filters by is indexed: `product_number`,
`barcode` (unique, partial — only when not null/empty), product `name`,
`brand`, `category`; `sale_date`, `customer_id` on `sales`; `purchase_date`,
`supplier_id` on `purchases`; the ledger tables by their owning
customer/supplier id; `stock_movements` by `product_id` and `created_at`;
`audit_logs` by `created_at`. This keeps product search and report queries
fast even with tens of thousands of products and bills (see §8).

## 4. Invoice numbering

Invoice numbers are generated by `nextInvoiceNumber()` in `sales.ts`:
`{invoicePrefix}-{financialYear}-{sequence}`, e.g. `KVM-2026-000042`. The
financial year rolls over on April 1st. The sequence is a plain integer
counter kept in the `settings` table (`invoice_seq_<year>`) that only ever
increments — **a cancelled bill's number is never reused**, and there is no
gap-filling. Purchases, sales returns, and purchase returns each have their
own independent sequence (`PUR-`, `RET-`, `PRT-`).

## 5. Transactions: all-or-nothing

`transaction()` in `database.ts` wraps a `BEGIN`/`COMMIT`, and nested calls
join the outermost transaction rather than starting a new one — so
`savePurchase()` can safely call into `addSupplierLedgerEntry()` and
`addMovement()` without either of them accidentally committing early. If
anything inside throws (a bad product id, a validation error, a constraint
violation), the whole transaction is rolled back and `schedulePersist()`
never runs — **nothing is written to disk**. This is what guarantees the
rules in the original spec:

- A sale is never saved with its stock update missing.
- A purchase is never saved without updating the supplier ledger.
- A credit sale is never saved without a customer ledger entry.
- A payment is never saved without updating the outstanding balance.

## 6. Two things are *derived*, never stored directly

**Current stock** is not a column on `products`. It is the sum of every
matching row in `stock_movements`:

```sql
SELECT COALESCE(SUM(qty), 0) FROM stock_movements WHERE product_id = ?
```

Every stock-changing event — opening stock, a purchase, a sale (negative),
a sales return (positive), a purchase return (negative), a manual
adjustment — inserts one signed row into `stock_movements` with a `type`
(`OPENING`/`PURCHASE`/`SALE`/`PURCHASE_RETURN`/`SALES_RETURN`/`ADJUST_IN`/
`ADJUST_OUT`), a reference back to the source transaction, and the user who
caused it. This gives a complete, auditable movement history per product
(shown in Reports → Stock Movement) instead of a single number that could
silently drift out of sync with reality.

**Customer/supplier outstanding** works the same way — it is opening
balance plus the running sum of the ledger:

```sql
c.opening_balance + SUM(customer_ledger.debit - customer_ledger.credit)
```

A sale on credit adds a debit; a payment received adds a credit; a sales
return or a cancelled credit sale adds a credit back. The customer's
"outstanding" figure shown everywhere in the UI is always computed from
this ledger, never edited directly.

## 7. Nothing financial is ever deleted

Bills, purchases, and returns are permanent records. Cancelling a bill
(`cancelBill` in `sales.ts`) does not delete the row — it sets
`status = 'CANCELLED'`, requires a typed reason, records who cancelled it
and when, reverses the stock movement, and reverses the customer ledger
entry if it was a credit sale. The original bill (its date, its original
total, its line items) stays exactly as it was.

Products, customers, and suppliers are the same idea at the master-data
level: `active` is a flag, not a delete. A product that's been sold before
can be deactivated (hidden from search) but never removed, because
historical `sale_items` rows still reference it by `product_id`.

Every sensitive action also writes a row to `audit_logs` — user, action,
entity + id, and an old/new value snapshot as JSON — including price
changes, product edits, bill cancellations, stock adjustments, credit-limit
overrides, and backup/restore. Prices and GST rates on old bills are also
immune to later changes: `sale_items`/`purchase_items` copy the product's
name, HSN, unit and GST rate at the moment of the transaction, so changing
a product later never rewrites history (see `gst.ts`'s doc comment: *"Rates
are never read from the product master when re-printing an old bill"*).

## 8. Performance

Product search (`searchProducts` in `products.ts`) is a single indexed
query with a `CASE`-based relevance order (exact product-number/barcode
match first, prefix match next, then substring), capped with `LIMIT`, so it
stays fast regardless of catalogue size. Every list/report screen paginates
or date-range-filters at the SQL level rather than loading the whole table
into the UI and filtering in JavaScript.

## 9. Backups

`src/lib/services/backup.ts` + `storage.ts` implement the folder layout
from the original spec:

```
%APPDATA%\KVM Agencies\      (Windows desktop app; see SOP.md)
  Database\kvm.db            the live database
  Backups\KVM_YYYY-MM-DD_HHMMSS.db
  Exports\                   Excel/CSV exports land here
  Invoices\                  reserved for future PDF invoice export
  Config\                    reserved for future local config files
  Logs\main.log              technical log only; never shown to shop staff
```

`backupNow()` serializes the live in-memory database and writes a
timestamped copy to `Backups\`. `restoreBackup()`/`importBackupFile()`
**always take a `KVM_SAFETY_*` backup of the current state first**, replace
the live database, then run `PRAGMA integrity_check` before accepting the
restored file — so a bad or corrupt backup can't wipe out today's data.
Settings → Backup & Data exposes the database's real on-disk location, the
last backup time, a list of every backup with one-click restore, an
"Open backup folder" button (so an owner can copy a backup to a USB drive),
and "Restore from file" for a `.db` copied in from elsewhere.
