# Deploying Unizo to a Company

This is the guide for whoever is rolling Unizo out to a business — installing
it for the first time, giving it that company's own branding, upgrading it
later, and moving data around safely. Day-to-day usage (billing, returns,
purchases) is in [`SOP.md`](./SOP.md) instead.

## 1. Installing for a new company

1. Download the latest build from the repository's **Releases** page:
   - **`Unizo-<version>-Windows.exe`** — portable. No install, no admin
     rights needed. Copy it anywhere and double-click it.
   - **`Unizo-<version>-Setup.exe`** — a normal installer with Start
     Menu/Desktop shortcuts and an uninstaller. Use this for a shop that
     wants Unizo to feel like a normal installed program.
2. Run it. Windows SmartScreen will show **"Windows protected your PC"** the
   first time — this is expected (the build isn't code-signed; that needs a
   paid certificate). Click **More info → Run anyway**.
3. The app opens straight into **First-time setup** — shop name, address,
   GSTIN, invoice numbering. This only ever happens once per install; it's
   saved into that computer's own data file the moment it's finished.
4. Create the owner account (username + password). Write the password down
   somewhere safe — see [Password recovery](#5-password-recovery) below for
   what happens if it's forgotten.
5. The product list, customers, and bills all start **completely empty**.
   There is no sample/demo data baked in — see
   [Loading their product list](#loading-their-product-list) next.

Each company's install is entirely independent. There's no shared account,
no license server, no phone-home of any kind — everything one company does
is invisible to every other install.

### Loading their product list

Don't make them type in hundreds of products by hand. **Products → Import**
accepts a CSV or Excel file:

1. Click **Download sample template** to get the exact column layout.
2. Fill in one row per product (product number, name, category, prices,
   GST rate, opening stock — see the template for the full list). An
   **Image URL** column is optional: if a product photo is reachable at a
   plain http(s) link, the import will try to download it automatically.
   Many image hosts block this, so treat it as a bonus — adding a photo by
   hand on the product screen always works.
3. Upload the file. The app shows exactly which rows are ready and which
   will be skipped, and why (missing fields, duplicate product numbers,
   etc.) — nothing is guessed or silently corrected.
4. Import. Existing product numbers are **never overwritten** by an import —
   a duplicate is skipped, not silently repriced. Re-run the same file
   later and only genuinely new rows go in.

## 2. Branding: logo and business name

Two different things are branded, and they don't mix:

- **The business's own name/logo** — set once during setup (or later in
  **Settings → Business Setup**), shown in the sidebar, the sign-in screen,
  and on printed invoices. Each company sets their own; there is no default
  tied to any other customer.
- **"Unizo by Adszoo"** — the product's own name, shown small in the
  sidebar footer and on the sign-in screen. This doesn't change per
  install.

To add a company's logo: **Settings → Business Setup → Upload logo**. It's
resized and stored inside that company's own data file (a few tens of KB),
the same way product photos are. Until a logo is uploaded, a plain default
Unizo mark is shown instead — nothing looks unbranded or broken without one.

The Windows `.exe` itself has one fixed icon (the default Unizo mark) across
every install — that's the taskbar/desktop-shortcut icon, and it isn't
practical to customize per company without producing a separate build for
each one. The in-app logo (sidebar, sign-in, invoices) is what actually
represents the business to their own staff and customers, and that *is*
fully customizable per install.

## 3. Upgrading an existing install

Installing a newer `.exe` over an older one is always safe — **it never
touches that company's data.** The program files and the data file live in
completely different places:

| | Location |
|---|---|
| Program files (replaced on upgrade) | Wherever the `.exe` was run from, or `Program Files` if installed |
| Data file (untouched by upgrade) | `%APPDATA%\Unizo\Database\kvm.db` |

So: download the new version, run it (or run the new installer over the
old one), done. Their bills, products, customers — everything — is exactly
as they left it.

**If they were on a build from before the product was renamed** (an older
"KVM Agencies"-branded build, which stored data under
`%APPDATA%\KVM Agencies\` instead): the first launch of a Unizo-branded
build detects that old folder automatically and copies its database and
backups across, once. Nothing is deleted from the old location — it's a
copy, not a move — so there's no way this step can lose data even if it
runs at the wrong time or twice.

## 4. Moving data between computers

There's no cloud sync — moving to a different PC (a new till, a replaced
computer, a second branch that should start from the same catalogue) is a
manual, deliberate copy:

1. On the old computer, open **Settings** and either:
   - click **Backup now** to create a fresh backup file, or
   - note the **Database location** shown there directly.
2. Copy that file (from `%APPDATA%\Unizo\Backups\` or the database file
   itself) onto a USB drive, network share, or however files normally move
   between these two machines.
3. Install Unizo on the new computer and get through first-time setup (or
   skip that by installing straight into an empty data folder — either way
   works).
4. On the new computer, go to **Settings → Restore from file** and pick the
   copied file. It's loaded in immediately, replacing whatever was there
   (a safety backup of the target machine's own prior state is taken
   automatically first, in case the wrong file gets picked).

The same **Restore from file** step is also how a downloaded backup gets
back into the app after any kind of data loss — a failed disk, an
accidental uninstall-and-delete-AppData, anything. As long as a backup file
survived, the shop's records did too.

## 5. Password recovery

There's no email or SMS on a fully offline app, so **Forgot your password?**
on the sign-in screen proves it's really the business (not a stranger who
picked up the computer) with the shop's own **GSTIN** instead — it's printed
on every invoice they've ever given out, so the real owner has it even with
the app password forgotten. It lets them set a brand new password directly;
there's nothing to "recover" as such, since passwords are one-way hashed
and never stored in a reversible form.

## 6. Testing before you ship a change

- `npm test` — fast unit tests for the money/GST math (the part where a bug
  means a wrong bill). Runs automatically before every build in CI.
- `npm run test:e2e` — end-to-end tests against a real build: a full
  billing flow (GST toggle, credit auto-fill, save) and a stress test that
  imports 500 products in one go and checks the app stays correct at that
  scale, not just fast. Build the app first (`npm run build:desktop`), then
  run this.
