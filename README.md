# Unizo

Offline billing, GST invoicing, stock and accounts management for retail and
trading businesses — by [Adszoo](#).

Unizo runs as a normal Windows desktop program. It works **100% offline**:
no internet connection, no cloud account, no server to manage. All data is
stored locally on the computer it's installed on, in a single SQLite
database file.

## What it does

- Fast, GST-compliant billing — with or without GST per bill
- Product catalogue with photos, categories, and bulk import from Excel/CSV
- Stock tracking with low-stock alerts
- Customer and supplier ledgers, credit/dues tracking
- Purchases from suppliers, with GST
- Sales, profit, and stock reports with charts, exportable to Excel/CSV
- GST filing reports: sales register, purchase register, HSN summary, tax summary
- Multiple staff logins with role-based permissions (Owner / Manager / Cashier)
- Full keyboard-driven billing — start to print without touching the mouse
- Automatic local backups, plus manual backup/restore
- Self-service password recovery (no email needed — it's fully offline)

See **[`features.md`](./features.md)** for the full, honest feature list.

## Documentation

| Doc | For |
|---|---|
| **[`DEPLOYMENT.md`](./DEPLOYMENT.md)** | Installing Unizo for a new company, branding, upgrading, and moving data between installs |
| **[`SOP.md`](./SOP.md)** | Plain-language guide for shop staff: billing, returns, purchases, backups |
| **[`DATABASE.md`](./DATABASE.md)** | The SQLite schema and the accounting rules the app is built on |
| **[`features.md`](./features.md)** | What's implemented today, screen by screen |

## Development

Requires Node.js.

```sh
git clone <this-repository-url>
cd unizo
npm install
npm run dev
```

## Building the Windows desktop app

The installed app runs the same production server that powers the web
preview — built with Nitro's `node-server` preset — as a background child
process bound to `127.0.0.1` only (never reachable from the network).
Electron opens a plain window pointed at it: no browser, no address bar, no
visible terminal for the person using it.

```sh
npm install
npm run build:desktop          # builds .output/ (the app server + static assets)
npx electron-builder --win portable nsis
```

This produces, in `release/`:

- **`Unizo-<version>-Windows.exe`** — portable. No installation, no admin
  rights. Double-click and it opens.
- **`Unizo-<version>-Setup.exe`** — a traditional installer with Start
  Menu/Desktop shortcuts and an uninstaller.

A GitHub Actions workflow (`.github/workflows/build-windows.yml`) builds
both on a real Windows runner on every push and publishes them as a GitHub
Release.

**Neither `.exe` is code-signed** (that needs a paid certificate), so
Windows SmartScreen shows a one-time "Windows protected your PC" warning —
click **More info → Run anyway**. This is expected and is explained in
`SOP.md`.

Where the installed app keeps its data: `%APPDATA%\Unizo\` (never the
Documents folder, since that's commonly OneDrive-synced on Windows, which
could let an active sync touch the live database file mid-write). See
`DATABASE.md` for the full folder layout and `DEPLOYMENT.md` for
backup/restore and upgrade instructions.
