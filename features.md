# KVM Agencies — Feature List

What the application actually does today, organized by module. Anything not
listed here as done is called out explicitly at the bottom under
**Not built yet**, so this document stays honest as the app grows.

Legend: 🖥️ = has a screen in the app · ⚙️ = business logic exists but has no
dedicated screen yet.

## Setup & Login

- 🖥️ First-time setup wizard: business name/address/GSTIN/state, invoice
  prefix and default bill footer, owner account creation, and an optional
  one-click demo dataset (30 products across 8 categories, 10 customers,
  5 suppliers, sample purchases/sales/returns/payments) for trying the app
  before going live.
- 🖥️ Username/password sign-in. Passwords are hashed with PBKDF2-SHA256
  (120,000 iterations) — never stored in plain text.
- Three roles — **Owner**, **Manager**, **Cashier** — with real permission
  gates, not just hidden buttons: pricing, purchase costs, profit figures,
  stock adjustments, discount limits (2%/10%/unlimited), backup restore,
  and settings are all enforced at the service layer (`services/auth.ts`),
  not just in the UI.
- Navigation itself adapts to role — a Cashier never even sees Purchases,
  Suppliers, Reports, GST, or Settings in the sidebar.

## Home / Dashboard 🖥️

- Today's sales, bill count, items sold.
- Payment split for today: Cash / UPI / Card / Credit.
- Customer and supplier outstanding totals.
- Stock value (cost and selling price).
- Low-stock list with quantities.
- Recent bills with status.
- One-click "New bill" action.

## Billing 🖥️ — the core counter workflow

- Product search by number, barcode, name, brand, category, or HSN, with
  scanner support (barcode input) and instant relevance ranking (exact
  match first).
- **Quick-add**: if a product genuinely doesn't exist yet, add it without
  leaving the bill.
- Customer selection (search by name/phone) with live credit
  limit/outstanding shown; defaults to Walk-in.
- Automatic price selection by customer type (Retail/Dealer/Contractor),
  with authorized manual override.
- Item-level and bill-level discounts, capped by role (Cashier 2%,
  Manager 10%, Owner unlimited) with a clear error if exceeded.
- Live GST calculation — CGST+SGST for intra-state, IGST for inter-state
  (driven by the customer's state code vs. the shop's), correctly
  distributing a bill-level discount across tax slabs.
- Split payments across Cash / UPI / Card / Credit / Other in any
  combination on one bill, with a reference number for UPI/card.
- Credit-limit warning when a credit sale would exceed the customer's
  limit; an authorized user can still proceed (recorded in the audit log).
- **Hold Bill** / **Resume Bill** — serve another customer without losing
  an in-progress cart.
- A4 and 80mm thermal invoice printing (configurable in Settings), with
  amount-in-words, tax breakdown by rate, and a CANCELLED watermark on
  cancelled bills.
- Keyboard shortcuts: F2/F3 navigate, F8 save, F9 save & print, Esc closes
  popups.

## Sales History & Returns 🖥️

- Filter by Today / Yesterday / This Week / This Month / a custom date
  range, plus free-text search by invoice number or customer.
- View any bill's full line items and payment split.
- Reprint any past invoice exactly as it was (immutable snapshot — a later
  price or GST change never alters an old bill).
- Cancel a bill (authorized users only): requires a typed reason, reverses
  stock, reverses the customer ledger if it was on credit, and keeps the
  original record permanently with its `CANCELLED` status.
- Sales returns: pick the original invoice, choose which lines and how
  much of each to return, require a reason; stock goes back in, the
  customer's ledger is credited, and the system will not let you return
  more than was actually sold (even across multiple partial returns).

## Products & Stock

- 🖥️ Product search/browse with live stock, prices, GST rate, category.
- 🖥️ Stock screen: current stock, minimum stock, low-stock-only filter,
  total cost/selling value.
- ⚙️ Product create/update, product-number auto-suggestion by category
  range, bulk percentage price updates, category/brand/unit lookups,
  barcode uniqueness — all implemented in `services/products.ts`, not yet
  wired to a screen (see **Not built yet**).
- ⚙️ Excel import with full validation (duplicate numbers/barcodes, missing
  names, invalid GST/prices/quantities, malformed HSN) and a downloadable
  template — implemented in `services/excel.ts`, not yet wired to a screen.
- Stock is never a single editable number — see `DATABASE.md` §6. Every
  change (opening stock, purchase, sale, return, manual adjustment) is a
  traceable, timestamped movement row with the user who made it.

## Purchases 🖥️

- New purchase entry: pick a supplier (search by name), add products by
  number/barcode/name, per-line quantity/price/discount with live GST and
  total, record how much was paid now and by what method.
- Saving a purchase increases stock, updates the product's cost price
  (optional), and updates the supplier ledger — all in one transaction.
- Purchase list with search and view-detail.
- Purchase returns: pick the products and quantity being returned (capped
  at what was purchased), require a reason; stock decreases and the
  supplier ledger is adjusted.

## Customers 🖥️

- List with search, outstanding-only filter, and running outstanding
  balance per customer.
- Add/edit: name, phone, address, GSTIN, type (Walk-in/Retail/
  Contractor/Dealer), credit limit, opening balance.
- Customer profile: type, phone, bill count, current outstanding, full
  ledger (every debit/credit with its reference), and recent payments.
- **Receive Payment**: amount, method, reference number, notes — updates
  the ledger immediately.
- Statement print (formatted, running balance) and CSV export.

## Suppliers 🖥️

- List with search and running outstanding balance.
- Add/edit: name, phone, address, GSTIN, opening balance.
- Supplier profile: ledger, purchase history, outstanding.
- **Pay Supplier**: amount, method, reference, notes.

## Reports 🖥️

Sixteen reports, each with a date range and one-click CSV export: Daily
Sales, Monthly Sales, Sales by Product, Sales by Category, Sales by Brand,
Sales by User, Purchase Report, Purchase by Supplier, Stock Report, Stock
Movement, Low Stock, Customer Outstanding, Supplier Outstanding, Payment
Collection, Cancelled Bills, Sales Returns. Gross profit/margin and cost
columns on the product/category/brand reports are hidden from anyone
without the `profit.view` permission (i.e., Cashiers never see margins).

## GST 🖥️

- **Sales Register** — every invoice with taxable value, CGST/SGST/IGST,
  and total, with a totals row, for a date range.
- **Purchase Register** — the same, for purchases.
- **HSN Summary** — quantity and tax grouped by HSN code and GST rate.
- **Tax Summary** — taxable value and tax grouped by GST rate slab.
- Every register/summary exports to CSV. GST rates are never recalculated
  from the current product master — every stored line preserves the rate
  that actually applied at the time of the transaction (see `DATABASE.md`).

## Settings 🖥️

- Business profile: name, address, phone, email, GSTIN, state/state code,
  invoice prefix, invoice footer, currency.
- Print format (A4 sheet or 80mm thermal roll), bill round-off toggle,
  low-stock alert toggle.
- **Backup & Data**: real database location, last backup time, count of
  stored backups, a full list of backups with one-click restore (with a
  safety backup taken automatically first), "Open backup folder", and
  "Restore from file" for a `.db` copied in from elsewhere (e.g. a USB
  drive).
- **Staff Accounts** (Owner only): add a Cashier/Manager/Owner account with
  a temporary password, reset anyone's password, enable/disable an
  account. A user can't disable their own account.

## Offline & data integrity

- 100% local: SQLite (via sql.js WASM) running in the browser tab or, in
  the packaged desktop app, in the Electron window — reading/writing a
  real file on disk. No server, no account, no internet call, anywhere in
  the app. See `DATABASE.md` for the full architecture and
  `SOP.md`/README for how to verify this yourself with the network cable
  unplugged.
- Every multi-step write (a bill, a purchase, a payment, a return, a
  cancellation) is one SQLite transaction — it either completes fully or
  leaves no trace at all. Stock and ledger balances are always *derived*
  from a movement/ledger history, never edited as a bare number, so they
  can't silently drift out of sync.
- Financial records are never deleted — only cancelled/deactivated, with a
  reason, a user, and a timestamp. An audit log records price changes,
  product/customer/supplier edits, stock adjustments, credit overrides,
  bill cancellations, and backups/restores.

## Windows desktop packaging

- A real Electron desktop app: double-click `KVM Agencies.exe`, a normal
  window opens (no browser, no address bar, no visible terminal, no
  "localhost" for the user to think about).
- The database and all backups live under
  `%APPDATA%\KVM Agencies\` — deliberately *not* the Documents folder,
  because Documents is commonly OneDrive-synced on Windows and that would
  risk silently uploading the "offline" database to the cloud or locking
  the file mid-write.
- Two installable forms are built from the same source: a portable
  single-file `.exe` (no installation, no admin rights) and a traditional
  installer `.exe` (Start Menu/Desktop shortcuts, uninstaller). See
  `README.md` for how to build them and `SOP.md` for day-to-day use.

## Not built yet

Being upfront about what's still missing, matching the phased plan in the
original spec:

- **Product add/edit and Excel import screens.** The underlying services
  (`createProduct`, `updateProduct`, `bulkPriceUpdate`, Excel
  parse/validate/import) are complete and tested, but the Products page
  only searches/lists today — there's no "Add Product" or "Import from
  Excel" button yet. This is the single most useful next addition.
- **Price Management screen** (bulk % price changes by category with a
  preview before applying) — service exists (`bulkPriceUpdate`), no UI.
- **Audit log viewer** — every sensitive action is recorded, but there's no
  screen to browse it yet.
- **Quotations, delivery challans, and project/site tracking** — not
  started; the database schema doesn't have these tables yet either. This
  matches Phase 7 of the original build plan.
- **Day Closing screen** (expected vs. actual cash, locking the day's
  records) — not started; the spec itself marks this as optional until
  validated with real shop use.
- **Automated test suite** — the transaction/rollback and GST-calculation
  logic have been manually verified end-to-end (including a real packaged
  Electron build), but there's no `npm test` yet.
