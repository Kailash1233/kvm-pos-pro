# KVM Agencies — Standard Operating Procedure

A plain-language guide for using KVM Agencies day to day. No computer
knowledge is needed beyond clicking, typing, and reading this page.

---

## 1. Installing the app (do this once, on the shop computer)

1. Copy `KVM-Agencies-Setup.exe` (or the portable `KVM-Agencies-Windows.exe`)
   onto the shop computer.
2. Double-click it.
3. Windows will show a blue **"Windows protected your PC"** screen. This is
   normal — it appears for any new app that hasn't paid Microsoft for a
   certificate. Click **More info**, then **Run anyway**.
4. If you used the Setup version: follow the install screen (Next → Next →
   Install), then open **KVM Agencies** from the Start Menu or the desktop
   shortcut it creates. If you used the portable version: it opens
   immediately, no installation step.
5. The app opens in its own window — not a web browser. You will never see
   a web address or need to type anything like "localhost".
6. The **first time** it opens, it will ask a few questions about your shop
   (name, address, GSTIN) and ask you to create the Owner's login. Do this
   once. After that, every time you open the app it goes straight to the
   sign-in screen.

**You do not need internet for any of this.** You can disconnect the
computer from Wi-Fi/network entirely and the app works exactly the same.

---

## 2. Starting your day

1. Double-click the **KVM Agencies** icon.
2. Sign in with your username and password.
3. You'll land on the **Home** screen — today's sales, cash/UPI/card split,
   any items running low, and your 10 most recent bills.

---

## 3. Making a normal sale

1. Click **New Bill** (or press **F2**).
2. Type the product number, scan the barcode, or type part of the name —
   the matching product(s) appear instantly. Press Enter or click it to
   add it to the bill.
3. If the customer wants a different quantity than 1, change it in the
   Qty box on that line.
4. Repeat for every item the customer is buying.
5. If the product genuinely does not exist yet, the search will show
   **"Add New Product"** — fill in the few required fields and it's added
   to the bill immediately, no need to start over.
6. (Optional) Select the customer — type their name or phone number. If
   you skip this, the bill is recorded as **Walk-in Customer**.
7. Check the total at the bottom. Apply a discount only if needed — your
   login has a maximum discount you're allowed to give without asking a
   manager.
8. Choose how they're paying: **Cash**, **UPI**, **Card**, or **Credit**.
   If they're splitting the payment (e.g. part cash, part UPI), enter both
   amounts.
9. Press **F8** to save, or **F9** to save and print immediately.

That's the whole flow: **Open → Bill → Product Number → Quantity →
Payment → Print.**

### If it's a credit sale

The screen will show the customer's current outstanding balance and their
credit limit. If this sale would take them over their limit, you'll see a
clear warning. Cashiers normally cannot push a sale through past the limit
— ask a Manager or the Owner to approve it if the customer needs it anyway.

### If a customer needs to step away mid-bill

Click **Hold Bill**. Their cart is saved. Serve the next customer normally.
When they come back, click **Held Bills** and pick their name to pick up
exactly where you left off.

---

## 4. Printing and reprinting

- Every bill can be printed as a full A4 sheet or a compact 80mm receipt —
  set which one your shop uses in **Settings → Bill size**.
- To reprint an old bill: go to **Sales**, find the bill (search by
  invoice number or customer, or filter by date), and click the printer
  icon.

---

## 5. Returns

### A customer is returning something they bought

1. Go to **Sales**, find the original bill, click the return icon.
2. Enter how much of each item is being returned and pick a reason
   (damaged, wrong item, excess, etc.).
3. Confirm. Stock goes back up automatically and, if the customer paid on
   credit, their outstanding balance goes down by the returned amount.

You can never return more of an item than was actually sold on that bill,
even if you try to return it in two separate trips — the system checks the
running total.

### You're returning stock to a supplier

1. Go to **Purchases**, find the original purchase, click the return icon.
2. Enter the quantity being returned and a reason. Confirm.
3. Stock goes down and what your shop owes that supplier is adjusted
   automatically.

---

## 6. Receiving new stock (a purchase)

1. Go to **Purchases → New Purchase**.
2. Pick the supplier (type their name).
3. Enter the supplier's invoice number and the date.
4. Add each product with its quantity and the price you're paying for it.
5. If you're paying the supplier something right now, enter the amount and
   how (cash/UPI/card).
6. Click **Save purchase**. Stock increases immediately, and whatever
   isn't paid today is added to what your shop owes that supplier.

---

## 7. Customers and suppliers

### Collecting a payment from a customer who owes you money

1. Go to **Customers**, find them, click **Receive**.
2. Enter the amount, how they paid, and a reference number if there is one
   (UPI transaction ID, cheque number, etc.).
3. Save. Their outstanding balance updates immediately.

You can also open a customer's full profile to see their statement (every
sale, payment, and return) and print or export it — useful if a customer
asks "what do I owe you and why?"

### Paying a supplier

Same idea, under **Suppliers → Pay**.

### Adding a new customer or supplier

**Customers → Add Customer** (or **Suppliers → Add Supplier**). Only the
name is required — everything else (phone, address, GSTIN, credit limit)
can be filled in later.

---

## 8. Reports and GST

- **Reports** has everything an owner needs day to day: today's/this
  month's sales, which products or categories are selling, what's owed to
  you, what you owe suppliers, stock levels, and more. Pick a report, set
  the date range, and click **Export CSV** if you want to open it in Excel.
- **GST** has the Sales Register, Purchase Register, HSN Summary, and Tax
  Summary your accountant will ask for at filing time — same idea, pick a
  date range and export.

---

## 9. Backing up your data — please don't skip this

Everything the shop does lives in **one file** on this computer. If this
computer is ever lost, stolen, or its hard disk fails, anything not backed
up is gone for good.

1. Go to **Settings → Backup & Data**.
2. Click **Backup now** whenever you like — it takes a couple of seconds.
3. Click **Open backup folder** and copy the newest file onto a USB drive
   or another computer regularly (weekly, at minimum). This step the app
   cannot do for you — a backup that only exists on the same computer
   doesn't protect you if that computer is what breaks.

### Restoring a backup (only the Owner should do this)

Only do this if you're sure — it replaces everything currently in the app
with whatever was in that backup.

1. **Settings → Backup & Data.**
2. Either pick one from the list and click **Restore**, or click
   **Restore from file** if you have a `.db` file copied in from a USB
   drive.
3. Confirm. The app automatically saves a safety copy of what's on the
   computer *right now* before doing anything, then reloads once it's done.

---

## 10. Staff accounts (Owner only)

**Settings → Staff Accounts.**

- **Add User**: give them a name, a username, a temporary password, and a
  role:
  - **Cashier** — billing, customer selection, payments, holding/reprinting
    bills. Cannot see profit, change prices, edit GST, or touch stock/backup.
  - **Manager** — everything a Cashier can do, plus products, purchases,
    customers/suppliers, returns, reports, and approving credit over a
    customer's limit. Cannot manage other staff accounts or restore backups.
  - **Owner** — everything, with no restrictions.
- **Reset password**: if someone forgets theirs.
- **Disable**: turns off a login without deleting their history (every
  bill they ever created stays exactly as it was). You cannot disable your
  own account.

---

## 11. Common problems

| What you see | What it means | What to do |
|---|---|---|
| "Product number already used by another product" | Two products can't share the same number | Pick a different number, or find and edit the existing one |
| "You cannot return more X than was sold" | The return quantity is more than what's left to return on that bill | Check how much was already returned |
| "Your role allows a maximum discount of X%" | Your login isn't authorized to give a bigger discount | Ask a Manager or Owner to apply it |
| A technical-looking error you don't understand | Something unexpected happened | Note what you were doing, then contact whoever manages the software for your shop. Nothing is lost — no bill is ever half-saved. |

If the app won't open at all, or a screen looks broken, **do not try to fix
it by editing files on the computer** — contact your administrator and
mention exactly what you clicked before it happened.

---

## 12. Proving it's really offline

If you ever want to check for yourself: unplug the network cable or turn
off Wi-Fi on the shop computer, then use the app normally — sign in, make a
bill, print it, add a purchase, run a report, take a backup. All of it
keeps working exactly the same, because none of it ever needed the
internet in the first place.
