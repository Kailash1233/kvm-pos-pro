# KVM Retail Manager

Build KVM Agencies Offline Retail & Construction Materials Management System

Build a production-ready Windows desktop application for KVM Agencies, a construction and building-materials retail/distribution business.

This is an offline-first local desktop application.

NON-NEGOTIABLE REQUIREMENT

The application must work 100% offline.

Do NOT build:

localhost web application

browser-based application

cloud database

Firebase

Supabase

MongoDB Atlas

PostgreSQL server

MySQL server

online authentication

online API dependency

telemetry

analytics sent to a server

cloud sync

remote database

internet-dependent features

The application must be installable on a Windows computer and launch like a normal desktop program:

KVM Agencies.exe

The user should double-click the application and immediately use it.

There should be no terminal, browser, localhost URL, server startup, npm command, or technical setup required by the shop user.

Use an embedded SQLite database stored locally on the computer.

Recommended architecture:

Tauri

React

TypeScript

SQLite

Rust/Tauri backend

Local filesystem for invoices, exports and backups

If a different desktop technology is technically superior, it must still satisfy the exact same offline/local requirements.

1. PRODUCT GOAL

Build a very simple POS + inventory + purchase + customer/supplier ledger + GST + reporting application specifically for a construction-materials shop.

The software should take useful concepts from established retail ERP/POS systems such as Shopaid, but must not become a complicated ERP interface.

The target users may have very limited computer literacy.

The UI must therefore be:

extremely simple

clean

fast

obvious

keyboard friendly

large buttons

large readable text

minimal terminology

minimal navigation

no unnecessary animations

no excessive cards

no AI-looking visual effects

no gradients unless genuinely useful

no glassmorphism

no excessive colors

no clutter

The application should feel like a professional business tool, not a generic SaaS dashboard.

2. CORE USER FLOW

The most important workflow is:

OPEN APPLICATION

→ HOME

→ NEW BILL

→ SEARCH PRODUCT BY PRODUCT NUMBER / BARCODE / NAME

→ ENTER QUANTITY

→ ADD MORE PRODUCTS

→ SELECT CUSTOMER

→ SELECT PAYMENT METHOD

→ CALCULATE GST

→ SAVE BILL

→ UPDATE STOCK

→ UPDATE CUSTOMER LEDGER IF CREDIT

→ PRINT BILL

Done.

A trained cashier should be able to create a normal bill in seconds.

3. MAIN NAVIGATION

The application must have only these primary sections:

Home

New Bill

Sales

Products

Purchases

Customers

Suppliers

Reports

GST

Settings

Do not create unnecessary top-level navigation items.

Use a persistent left sidebar or similarly clear navigation.

Show the current logged-in user.

4. HOME / DASHBOARD

The Home screen should immediately show:

Today's summary

Today's Sales

Number of Bills

Items Sold

Cash

UPI

Card

Credit

Customer Outstanding

Supplier Outstanding

Example:

TODAY

Sales: ₹84,560

Bills: 47

Items Sold: 326

Cash: ₹21,500

UPI: ₹30,660

Card: ₹0

Credit: ₹32,400

Also show:

Low Stock

Display products below their minimum stock level.

Recent Bills

Show the latest 10 bills.

Each bill should allow:

View

Reprint

Cancel if authorized

Quick Actions

Large buttons:

NEW BILL

PURCHASE

PRODUCTS

CUSTOMERS

REPORTS

The Home screen must be usable by a non-technical user without training.

5. PRODUCT SYSTEM

Products are the foundation of the application.

Every product must have a unique Product Number.

Example:

101 = UltraTech PPC Cement

102 = UltraTech OPC Cement

201 = PVC Elbow 1"

202 = PVC Tee 1"

301 = TMT Rod 20mm

The Product Number must be prominently displayed throughout the application.

Product identifiers

Every product should support:

Internal database ID

Product Number

Barcode

Product Name

Category

Subcategory

Brand

The billing system must search by:

Product Number

Barcode

Product Name

Brand

HSN

partial text

Example:

Typing:

101

immediately finds:

UltraTech PPC Cement

Typing:

ultra

finds all matching UltraTech products.

Scanning a barcode should add the corresponding product.

6. PRODUCT NUMBER SYSTEM

Product numbers should be simple human-friendly numbers.

Recommended ranges:

100-199 Cement
200-299 Plumbing
300-399 Steel
400-499 Paint
500-599 Electrical
600-699 Hardware
700-799 Sanitary
800-899 Other

However, do NOT hard-code these ranges.

The owner should be able to assign any available product number.

Product numbers must be unique.

Do not use the product number as the database primary key.

Use an internal immutable database ID.

7. PRODUCT MASTER

Product fields:

ID

Product Number

Barcode

Product Name

Category

Subcategory

Brand

Unit

HSN Code

GST Rate

Purchase Price

Retail Price

Dealer Price

Contractor Price

Minimum Stock

Active/Inactive

Created At

Updated At

Do not require unnecessary fields during normal product creation.

Provide:

Simple Add Product

Product Number

Product Name

Category

Brand

Unit

Purchase Price

Selling Price

GST

Opening Stock

Minimum Stock

Advanced Product Details

Barcode

HSN

Dealer Price

Contractor Price

Supplier

other optional metadata

8. QUICK ADD PRODUCT DURING BILLING

If a cashier searches for a product that doesn't exist, show:

PRODUCT NOT FOUND

[ + ADD NEW PRODUCT ]

Allow the user to create the product without leaving the current bill.

After saving:

Automatically add the new product to the current bill.

Do not make the cashier cancel the bill.

9. PRICE MANAGEMENT

Create a dedicated Price Management screen.

Allow:

search product

edit selling price

edit purchase price with authorization

retail price

dealer price

contractor price

Support bulk price updates.

Example:

Category:

Cement

Change:

Increase by 5%

Preview the affected products.

Require confirmation before applying.

Record every price change in the audit log.

10. EXCEL IMPORT

Excel bulk import is mandatory.

Provide:

[ DOWNLOAD EXCEL TEMPLATE ]

Template columns:

Product Number

Product Name

Category

Subcategory

Brand

Unit

Purchase Price

Retail Price

Dealer Price

Contractor Price

GST

HSN

Opening Stock

Minimum Stock

Barcode

The import process must be:

Excel Upload

→ Parse

→ Validate

→ Preview

→ Show Errors/Warnings

→ Confirm

→ Import

Never silently import invalid data.

Validation must detect:

duplicate Product Numbers

duplicate Barcodes

missing Product Names

invalid GST

invalid prices

invalid quantities

unknown categories

unknown brands

invalid HSN

malformed data

Show row numbers for errors.

Example:

Row 27:

ERROR: Product Number already exists.

Allow users to correct and re-upload.

11. EXCEL EXPORT

Allow exporting:

Products

Sales

Purchases

Stock

Customers

Suppliers

Customer Outstanding

Supplier Outstanding

GST Sales

GST Purchases

HSN Summary

Product Sales

Reports

Exports must work offline.

12. BILLING SCREEN

This is the most important screen.

Design it for maximum speed.

Layout:

NEW BILL

Customer:
[ Walk-in Customer ]

Product Search:
[ Product Number / Barcode / Product Name ]

Bill table:

Product No
Product
Qty
Unit
Price
Discount
GST
Total

Example:

101 | UltraTech PPC | 10 | Bag | ₹380 | ₹0 | 28% | ₹3,800

201 | PVC Elbow | 20 | Piece | ₹45 | ₹0 | 18% | ₹900

Bottom:

Subtotal

Discount

Taxable Amount

CGST

SGST

IGST

Round Off

GRAND TOTAL

Payment:

[ CASH ]

[ UPI ]

[ CARD ]

[ CREDIT ]

Provide keyboard shortcuts.

13. KEYBOARD-FIRST BILLING

Support:

F1 = New Bill

F2 = Product Search

F3 = Customer

F4 = Payment

F5 = Hold Bill

F6 = Retrieve Held Bill

F8 = Print

ESC = Cancel/Close popup

ENTER = Confirm / Next

TAB = Next field

The actual shortcuts can be changed later in settings.

Do not force users to use a mouse for every operation.

14. HOLD BILL

Cashiers must be able to temporarily hold an unfinished bill.

Example:

Customer leaves to get another product.

Click:

[ HOLD BILL ]

Then serve another customer.

Later:

[ HELD BILLS ]

Select customer/bill.

[ RESUME ]

Continue exactly where they left off.

15. PAYMENT SYSTEM

Support:

Cash

UPI

Card

Credit

Other

Support split payments.

Example:

Total = ₹10,000

Cash = ₹2,000

UPI = ₹3,000

Credit = ₹5,000

The system must correctly record all three.

Payment references can be stored for UPI/card.

16. CUSTOMER SYSTEM

Customer fields:

ID

Name

Phone

Address

GSTIN

Customer Type

Credit Limit

Opening Balance

Active

Created At

Updated At

Customer types:

Walk-in

Retail

Contractor

Dealer

Customer profile should show:

Total purchases

Number of bills

Outstanding

Payment history

Sales history

Returns

Projects/sites

17. CREDIT SALES

If payment method is CREDIT:

Show:

Customer

Current Outstanding

Credit Limit

Current Bill

New Outstanding

If the credit limit is exceeded:

Show a clear warning.

Do not automatically block the transaction if the logged-in user has permission to approve it.

Record the approval in the audit log.

18. CUSTOMER PAYMENT COLLECTION

Provide:

RECEIVE PAYMENT

Customer

Current Outstanding

Amount

Payment Method

Reference Number

Notes

SAVE PAYMENT

This should update the customer ledger immediately.

19. CUSTOMER STATEMENT

Show:

Opening Balance

Sales

Payments

Returns

Adjustments

Closing Outstanding

Allow:

Print

PDF

Excel

CSV

20. SUPPLIER SYSTEM

Supplier fields:

ID

Name

Phone

Address

GSTIN

Opening Balance

Active

Created At

Updated At

Supplier profile must show:

Purchase history

Payments

Returns

Outstanding

21. PURCHASE SYSTEM

Create:

NEW PURCHASE

Supplier

Supplier Invoice Number

Date

Products

Quantity

Purchase Price

Discount

GST

Total

Payment Status

Save Purchase.

When the purchase is saved:

STOCK MUST INCREASE.

Supplier ledger must update.

This must happen in one SQLite database transaction.

22. PURCHASE RETURN

Support purchase returns.

Flow:

Select original purchase

Select products

Enter return quantity

Confirm

Then:

Stock decreases

Supplier ledger adjusts

Tax values adjust appropriately

Create a permanent purchase return record.

23. SALES RETURN

Support sales returns.

Flow:

Search original invoice

Select product

Enter returned quantity

Select reason

Confirm

Then:

Stock increases

Customer ledger/payment adjustment occurs

Tax adjustment occurs

Create permanent sales return record.

Do not allow returning more quantity than was originally sold.

24. STOCK ENGINE

Do NOT store current stock as the only source of truth.

Maintain a stock movement ledger.

Stock should conceptually be:

Opening Stock

Purchases

Sales Returns

Positive Adjustments

Sales

Purchase Returns

Negative Adjustments

= Current Stock

Every stock change must have a traceable source.

25. STOCK MOVEMENT TYPES

Support:

Opening

Purchase

Sale

Purchase Return

Sales Return

Adjustment In

Adjustment Out

Each stock movement should store:

Product

Quantity

Transaction Type

Reference Transaction

Date

User

Unit Cost

Notes

26. STOCK ADJUSTMENT

Owner/manager can manually adjust stock.

Require:

Product

Quantity

Increase/decrease

Reason

Examples:

Damaged

Missing

Physical count correction

Sample

Other

Never silently modify stock.

Record the adjustment in the audit log.

27. LOW STOCK

Every product can have a minimum stock level.

If:

Current Stock < Minimum Stock

Show it in:

Home dashboard

Stock report

Allow filtering:

LOW STOCK ONLY

28. MULTIPLE PRICES

Products can have:

Purchase Price

Retail Price

Dealer Price

Contractor Price

Customer type can determine the default price.

Example:

Retail customer → Retail Price

Dealer → Dealer Price

Contractor → Contractor Price

Allow authorized manual price override.

29. DISCOUNT CONTROL

Support item-level and bill-level discounts.

Permissions must control discount limits.

Example:

Cashier = up to 2%

Manager = up to 10%

Owner = unlimited

If discount exceeds permission:

Require authorized manager/owner approval.

30. QUOTATIONS

Create a quotation module.

Quotation contains:

Customer

Date

Products

Quantities

Prices

Discount

GST

Total

Notes

Validity

Allow:

[ PRINT QUOTATION ]

[ CONVERT TO BILL ]

When converted:

Do not re-enter products manually.

31. DELIVERY CHALLAN

Support delivery challans.

Fields:

Challan Number

Customer

Sale/Bill Reference

Site Address

Vehicle Number

Driver Name

Date

Products

Quantities

Status

Allow printing.

32. PROJECT / SITE TRACKING

For contractor customers, optionally associate bills with a project/site.

Example:

ABC Constructions

Projects:

Tambaram Villa

Chengalpattu Apartment

Warehouse Project

Sales can be associated with a project.

Project report should show:

Material purchased

Quantity

Total value

Bills

Outstanding

Keep this feature simple.

33. SALES HISTORY

Sales page should support:

Today

Yesterday

This Week

This Month

Custom Date Range

Columns:

Invoice Number

Date

Customer

Amount

Payment Status

Created By

Status

Actions:

View

Print

Reprint

Cancel if authorized

34. PRODUCT-WISE SALES REPORT

Show:

Product

Quantity Sold

Sales Amount

Cost

Gross Profit

Margin

Example:

Cement

Quantity: 2,840

Sales: ₹10,51,000

Cost: ₹9,64,000

Gross Profit: ₹87,000

Margin: 8.28%

35. CATEGORY SALES

Show:

Cement

Plumbing

Steel

Paint

Electrical

Hardware

Sanitary

Other

Include:

Quantity

Revenue

Gross Profit

Margin

36. BRAND SALES

Show sales performance by brand.

Example:

UltraTech

Asian Paints

Astral

Tata

etc.

37. PURCHASE REPORT

Show:

Supplier

Purchase Invoice

Date

Amount

GST

Payment Status

Products

38. PROFIT

Gross profit should be calculated as:

Selling Price

minus

Cost Price

Cost Price must come from the transaction/product costing method defined by the system.

For initial implementation, use the product's recorded purchase cost / transaction cost.

Do not expose profit information to cashiers.

39. GST SYSTEM

Every product must have:

HSN Code

GST Rate

Every transaction must store the GST rate applicable at the time of transaction.

Never calculate historical bills using the product's current GST rate.

Historical transactions must preserve their original:

taxable amount

GST rate

CGST

SGST

IGST

40. GST LOCAL SALE

For intra-state sales:

Taxable Amount

CGST

SGST

Total

Example:

Taxable = ₹10,000

GST = 18%

CGST = ₹900

SGST = ₹900

Total = ₹11,800

41. GST INTERSTATE SALE

For interstate sales:

Taxable Amount

IGST

Total

Example:

Taxable = ₹10,000

IGST = ₹1,800

Total = ₹11,800

Do not hard-code these calculations. Use configurable tax rates.

42. GST REPORTS

Create:

Sales Register

Purchase Register

Tax Summary

HSN Summary

CGST Summary

SGST Summary

IGST Summary

Allow:

Excel

CSV

PDF

Do not claim automatic GST filing in version 1.

Build the data structure so compatible export/integration can be added later.

43. INVOICE NUMBERING

Use human-readable invoice numbers.

Example:

KVM-2026-000001

KVM-2026-000002

KVM-2026-000003

Invoice numbering must be sequential.

Never reuse a cancelled invoice number.

44. INVOICE DATA IMMUTABILITY

Historical invoices must remain accurate.

If a product's:

name

price

GST

HSN

brand

changes later, old invoices must not change.

Store the relevant snapshot values inside transaction records.

45. BILL CANCELLATION

Do not physically delete financial transactions.

If a bill is cancelled:

mark status = CANCELLED

reverse stock appropriately

reverse/adjust customer ledger

retain original transaction

require cancellation reason

record user and timestamp

Never delete historical financial records silently.

46. AUDIT LOG

Record important actions:

Price change

Product creation

Product modification

Product deletion/deactivation

Bill creation

Bill cancellation

Purchase creation

Purchase cancellation

Returns

Stock adjustments

Credit overrides

Discount overrides

User changes

GST configuration changes

Backup/restore

Audit fields:

User

Action

Entity

Entity ID

Old Value

New Value

Timestamp

47. USER ROLES

Create:

OWNER

Full access.

MANAGER

Access to:

Products

Prices

Purchases

Customers

Suppliers

Returns

Reports

Credit approval

But restrict:

User management

Full backup restore

critical settings

CASHIER

Access to:

New Bill

Product search

Customer selection

Payments

Hold bill

Reprint bill

basic sales history

Cannot:

change prices

modify GST

edit purchase prices

see profit

delete products

perform unrestricted stock adjustments

manage users

restore database

Permissions should be granular enough to modify later.

48. DATABASE SCHEMA

Use SQLite.

Core tables:

users

roles

permissions

role_permissions

categories

brands

units

products

product_prices

customers

customer_ledger

customer_payments

suppliers

supplier_ledger

supplier_payments

sales

sale_items

sale_payments

sales_returns

sales_return_items

purchases

purchase_items

purchase_returns

purchase_return_items

stock_movements

quotations

quotation_items

delivery_challans

delivery_challan_items

tax_rates

settings

audit_logs

held_bills

projects

project_transactions

49. DATABASE RULES

Use foreign keys.

Use indexes for:

product_number

barcode

product_name

invoice_number

customer phone

GSTIN

sale_date

purchase_date

stock product ID

ledger customer ID

ledger supplier ID

Product Number must have a UNIQUE constraint.

Barcode should be unique when present.

Invoice Number must be UNIQUE.

Do not store financial totals as floating point where precision could create accounting problems.

Use integer minor units where practical, such as paise, or an exact decimal strategy.

All important financial operations must use SQLite transactions.

50. SALES TRANSACTION

When saving a sale:

Validate products

Validate quantities

Validate price

Calculate discount

Calculate taxable amount

Calculate GST

Calculate final total

Create sale record

Create sale items

Create payment records

Create stock OUT records

Create customer ledger entry if credit

Commit transaction

Print invoice

If any step fails:

ROLLBACK EVERYTHING.

Never leave half-created bills.

51. PURCHASE TRANSACTION

When saving purchase:

Validate supplier

Validate products

Calculate taxes

Create purchase

Create purchase items

Create stock IN records

Create supplier ledger entry

Save payment

Commit

If any operation fails:

ROLLBACK.

52. BACKUP SYSTEM

Because the software is offline, backups are critical.

Implement automatic local backups.

Suggested structure:

KVM Agencies/

Database/

Backups/

Exports/

Invoices/

Config/

Logs/

Backup examples:

KVM_2026-09-01_210000.db

KVM_2026-09-02_210000.db

KVM_2026-09-03_210000.db

Keep at least:

7 daily backups

4 weekly backups

Allow:

[ BACKUP NOW ]

[ RESTORE BACKUP ]

[ OPEN BACKUP FOLDER ]

Backups must be created safely.

Before restore:

close active transactions

create a safety backup of current database

validate backup

restore

reopen application

Never overwrite the current database without creating a safety backup.

53. DATABASE LOCATION

Store the database in a proper application-data directory, not inside temporary files.

The user should not need to interact with it manually.

The application should expose:

Settings → Backup & Data

where the owner can see:

Database status

Database location

Last backup

Backup count

54. OFFLINE REQUIREMENT

After installation, disconnect the computer from the internet.

The application must still support:

login

billing

product search

purchases

stock

customer accounts

supplier accounts

GST calculations

reports

printing

Excel import/export

PDF generation

backup

restore

No functionality should fail because the internet is unavailable.

55. PRINTING

Support:

A4 invoice

Professional GST invoice containing:

Business name

Address

Phone

GSTIN

Invoice number

Date

Customer information

Customer GSTIN if available

Product Number

Product Name

Quantity

Unit

Rate

Discount

Taxable Value

GST

CGST

SGST

IGST

Round-off

Grand Total

Payment Method

Terms/notes

Authorized signature area

80mm thermal invoice

Compact format.

Both formats must be configurable.

56. BUSINESS SETTINGS

Owner can configure:

Business Name

Address

Phone

Email

GSTIN

State

State Code

Invoice Prefix

Invoice Number

Invoice Footer

Logo if desired

Default Printer

A4/thermal format

Currency

Tax settings

57. SEARCH

Search must be fast.

Product search must support:

Product Number

Barcode

Name

Brand

Category

HSN

Partial text

Customer search:

Name

Phone

GSTIN

Supplier search:

Name

Phone

GSTIN

Invoice search:

Invoice Number

Customer

Date

Amount

58. UI DESIGN

Use a clean professional desktop interface.

Primary design principles:

light background

clear typography

strong contrast

consistent spacing

large buttons

clear labels

minimal icons

no unnecessary decoration

no excessive dashboard cards

no excessive charts

no confusing color coding

Use icons only when they improve comprehension.

Avoid tiny controls.

The interface should be comfortable on a normal 1366x768 Windows display.

It should also scale to 1920x1080.

59. ERROR HANDLING

Errors must be understandable to normal users.

Do not show:

"SQLITE_CONSTRAINT_FOREIGNKEY"

Instead show:

"Unable to save this purchase because the selected supplier is no longer available."

For technical errors, provide:

"Something went wrong. Please contact the administrator."

Allow technical logs to be written locally.

Never expose stack traces to normal users.

60. CONFIRMATION DIALOGS

Use confirmation for destructive or important actions:

Cancel invoice

Return products

Delete/deactivate product

Change GST

Bulk price update

Stock adjustment

Restore backup

Do not ask for confirmation for every trivial action.

61. DATA DELETION

Financial records should not be physically deleted.

Use:

Active

Inactive

Cancelled

Voided

depending on the entity.

Products can be deactivated.

Customers can be deactivated.

Suppliers can be deactivated.

Invoices remain permanently recorded.

62. IMPORT SAFETY

Before importing Excel:

Create a temporary staging dataset.

Validate everything.

Show preview.

Only after confirmation insert into the actual tables.

If import fails:

ROLLBACK.

Never leave half-imported products.

63. PERFORMANCE

The application should remain fast with:

10,000 products

50,000 products

100,000+ bills

hundreds of thousands of sale items

Use proper SQLite indexes.

Do not load the entire database into the UI.

Use pagination and efficient queries.

Product search should feel instant.

64. SECURITY

Passwords must never be stored as plain text.

Use password hashing.

Local database should not expose credentials.

Implement session timeout if configured.

Lock the application after inactivity if enabled.

Sensitive operations require authorization.

65. APPLICATION STARTUP

When opening:

Show a simple loading screen.

Load local SQLite database.

Verify database integrity.

Load configuration.

Show login if authentication is enabled.

Then Home.

Startup should be fast.

No internet check.

No online authentication.

No network call.

66. FIRST-TIME SETUP

First launch should show a simple setup wizard:

STEP 1

Business Name

STEP 2

Address

STEP 3

GSTIN

STEP 4

State

STEP 5

Create Owner Account

STEP 6

Printer Setup

STEP 7

Product Import

Allow:

[ IMPORT PRODUCTS FROM EXCEL ]

or:

[ ADD PRODUCTS MANUALLY ]

Then enter the main application.

67. SAMPLE DATA

During development, provide a sample dataset so the application can be tested.

Include:

30 products

several categories

several brands

10 customers

5 suppliers

sample purchases

sample sales

sample returns

sample payments

Provide a "Demo Data" mode or seed script that is clearly separated from production data.

68. REPORT FILTERS

Reports should support:

Date range

Category

Subcategory

Brand

Product

Customer

Supplier

Payment method

User

Status

Export.

69. REPORTS REQUIRED

Implement:

Daily Sales

Monthly Sales

Sales by Product

Sales by Category

Sales by Brand

Purchase Report

Purchase by Supplier

Stock Report

Stock Movement

Low Stock

Customer Outstanding

Supplier Outstanding

Customer Statement

Supplier Statement

Payment Collection

Gross Profit

Margin

GST Sales

GST Purchases

HSN Summary

Tax Summary

Cancelled Bills

Returns

User Sales

70. END-OF-DAY

Create an optional:

DAY CLOSING

screen.

Show:

Total Sales

Cash Sales

UPI Sales

Card Sales

Credit Sales

Returns

Discounts

Expected Cash

Actual Cash

Difference

Bills Count

Items Sold

Allow:

[ CLOSE DAY ]

Once closed, normal users cannot modify the day's financial records without authorized action.

Do not make this mandatory until the workflow is validated with KVM users.

71. DATA MODEL PRINCIPLE

The system must be transaction-driven.

Do not make the database dependent on manually edited totals.

For example:

Current customer outstanding should be derivable from ledger transactions.

Current stock should be derivable from stock movements.

Sales totals should come from sale records.

GST reports should come from transaction tax records.

This keeps the system auditable.

72. APPLICATION ARCHITECTURE

Use this conceptual architecture:

Desktop UI

↓

Application Services

↓

Transaction Engine

↓

SQLite Repository/Data Layer

↓

SQLite Database

Separate modules:

UI

Auth

Products

Sales

Purchases

Inventory

Customers

Suppliers

GST

Reports

Printing

Excel Import/Export

Backup/Restore

Audit

Settings

Do not mix business logic directly into React components.

73. BUSINESS LOGIC LAYER

Create separate services such as:

ProductService

SalesService

PurchaseService

InventoryService

CustomerService

SupplierService

PaymentService

GSTService

ReportService

QuotationService

DeliveryService

BackupService

ImportService

ExportService

AuditService

PrintingService

The UI should call these services rather than directly manipulating database tables.

74. TESTING REQUIREMENTS

Write tests for:

GST calculations

CGST/SGST

IGST

discounts

split payments

credit sales

stock deduction

stock returns

purchase stock addition

purchase returns

customer outstanding

supplier outstanding

invoice numbering

cancelled invoices

price changes

Excel import validation

backup

restore

Especially test transaction rollback.

Example:

If stock update fails during a sale, the sale must not remain partially saved.

75. CRITICAL ACCOUNTING RULE

Never allow:

Sale saved but stock not updated.

Purchase saved but stock not updated.

Credit sale saved but customer ledger not updated.

Payment saved but outstanding not updated.

Return saved but inventory not adjusted.

These must be atomic operations.

76. FUTURE-READY BUT NOT IMPLEMENTED

Design the architecture so these can be added later:

cloud backup

multi-branch

cloud synchronization

mobile application

online ordering

WhatsApp integration

customer portal

supplier portal

advanced accounting

GST API integration

e-commerce

ONDC

But DO NOT implement them now.

The current application remains 100% local/offline.

77. WHAT NOT TO DO

Do not:

create a web app requiring localhost

require internet

require a database server

create unnecessary ERP complexity

create 30 menu items

use tiny fonts

hide common actions behind menus

force mouse-only operation

make product creation complicated

allow financial records to be physically deleted

calculate historical GST using current product settings

store passwords in plain text

silently alter stock

silently alter prices

silently modify historical bills

silently import bad Excel data

78. DEVELOPMENT ORDER

Build in this order:

PHASE 1

Desktop shell

SQLite database

Database migrations

Authentication

Settings

Roles/permissions

Backup/restore foundation

PHASE 2

Categories

Brands

Units

Products

Product Numbers

Product Search

Excel Import/Export

PHASE 3

Billing

Payments

Invoice numbering

Printing

Held bills

Sales history

PHASE 4

Inventory

Stock ledger

Purchases

Purchase returns

Sales returns

Stock adjustments

Low-stock alerts

PHASE 5

Customers

Customer ledger

Credit sales

Payment collection

Statements

Suppliers

Supplier ledger

PHASE 6

GST

GST reports

HSN

Tax summaries

PHASE 7

Quotations

Delivery challans

Projects/sites

Multiple pricing

Discount permissions

PHASE 8

Reports

Profit

Margins

Dashboards

Day closing

PHASE 9

Audit logs

Hardening

Performance

Backup testing

Restore testing

Installer

Production packaging

79. FINAL ACCEPTANCE CRITERIA

The application is not complete until a normal shop employee can do all of the following without technical knowledge:

Open the application offline.

Login.

Search product using Product Number.

Search product using name.

Scan a barcode.

Add quantity.

Add multiple products.

Add a new product during billing.

Change price with permission.

Create a bill.

Apply discount.

Calculate GST.

Accept cash.

Accept UPI.

Accept card.

Create credit sale.

Split payment.

Print A4 invoice.

Print thermal invoice.

Reprint an old bill.

Hold a bill.

Resume a bill.

Cancel a bill with authorization.

Process sales return.

Add a purchase.

Process purchase return.

See current stock.

See stock movement.

See low stock.

Add customer.

Receive customer payment.

View customer outstanding.

Print customer statement.

Add supplier.

View supplier outstanding.

Import products from Excel.

Export products to Excel.

Generate daily sales report.

Generate monthly sales report.

Generate product-wise sales.

Generate category-wise sales.

Generate purchase report.

Generate stock report.

Generate GST report.

Generate HSN report.

Generate profit report for authorized users.

Create quotation.

Convert quotation to bill.

Create delivery challan.

Associate contractor sales with a project/site.

Perform backup.

Restore backup.

Use the entire application with the internet disconnected.

80. MOST IMPORTANT UX REQUIREMENT

When designing every screen, ask:

"Can a person who has barely used a computer understand what to do here?"

If not, simplify it.

The software should hide complexity from the user.

The underlying system can be sophisticated.

The user interface must not be.

The ultimate user experience should be:

OPEN

→ BILL

→ PRODUCT NUMBER

→ QUANTITY

→ PAYMENT

→ PRINT

Everything else should support that core workflow without getting in its way.

Build the application as a real installable Windows desktop application, not a browser application disguised as desktop software.

The final deliverable should include:

production-ready source code

SQLite migrations

database schema

seed/demo data

automated tests

Windows installer

application icon

backup/restore

Excel templates

invoice templates

sample configuration

README for developers

simple user guide for shop staff

Before considering the project complete, test the entire application with the internet physically disconnected and verify that billing, inventory, purchases, reports, GST, printing, Excel and backups continue to work normally.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/35693aa6-0418-4402-a308-3543779e726e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Documentation

- **`features.md`** — what the application does today, screen by screen,
  and what's honestly still missing.
- **`DATABASE.md`** — the SQLite schema, the money/quantity conventions,
  and the accounting rules (transactions, derived balances, immutable
  history) the whole app is built around.
- **`SOP.md`** — a plain-language guide for shop staff: installing the app,
  making a sale, returns, purchases, backups, and staff accounts.

## Building the Windows desktop app (`KVM Agencies.exe`)

The app ships as a normal Electron desktop app. The **same production
build** that powers the hosted web preview runs the show — it's built with
Nitro's `node-server` preset instead of the Cloudflare preset used for the
web preview, then Electron runs that server as a background child process
bound to `127.0.0.1` only (never reachable from the network) and opens a
plain window pointed at it. There is no browser, no address bar, and no
visible terminal for the person using it.

```sh
npm i
npm run build:desktop          # builds .output/ (the app server + static assets)
npx electron-builder --win portable nsis
```

This produces, in `release/`:

- **`KVM-Agencies-<version>-Windows.exe`** — portable. No installation, no
  admin rights. Double-click and it opens.
- **`KVM-Agencies-<version>-Setup.exe`** — a traditional installer with
  Start Menu/Desktop shortcuts and an uninstaller.

Both are built from any machine (Linux, macOS, or Windows) — cross-building
the Windows target from Linux needs `wine` installed
(`apt-get install wine wine32:i386` on Debian/Ubuntu, or just build directly
on Windows/CI where none of that is needed). A GitHub Actions workflow
(`.github/workflows/build-windows.yml`) builds it on a real Windows runner
on every push and publishes both `.exe` files as a GitHub Release — the
most reliable way to get a verified build without a local wine setup.

**Neither `.exe` is code-signed** (that needs a paid certificate), so
Windows SmartScreen shows a one-time "Windows protected your PC" warning —
click **More info → Run anyway**. This is expected and is explained in
`SOP.md` for shop staff.

Where the installed app keeps its data: `%APPDATA%\KVM Agencies\` (never
the Documents folder, since Documents is commonly OneDrive-synced on
Windows and that would risk an active sync touching the live database
file). See `DATABASE.md` for the full folder layout and `SOP.md` for
backup/restore instructions.
