// Electron main process for the Unizo desktop app.
//
// Architecture:
//  1. Owns the local data folder (Database / Backups / Exports / Config /
//     Logs) under the Windows per-user AppData folder - never
//     Documents/OneDrive, so an active OneDrive sync can never touch the
//     live database file.
//  2. Runs the app's real production server (the same TanStack Start SSR
//     build used for the hosted web preview, just built with Nitro's
//     "node-server" preset instead of the Cloudflare Worker preset) as a
//     child process bound to 127.0.0.1 only. This is the exact same
//     request-handling code path already proven to work - nothing about
//     routing/rendering changes between the web preview and this build.
//     Nothing here is reachable from the network; there is no browser, no
//     visible URL, and no terminal - the child process is invisible to the
//     user, exactly like any other Electron+web-framework desktop app.
//  3. Exposes a small file-system bridge to the renderer via preload.cjs,
//     implementing the DesktopBridge interface the app already expects
//     (see src/lib/db/storage.ts).
"use strict";

const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const { fork } = require("node:child_process");

app.setName("Unizo");
if (app.setAppUserModelId) app.setAppUserModelId("com.adszoo.unizo");

const ROOT_DIR = path.join(app.getPath("appData"), "Unizo");
const DIRS = {
  root: ROOT_DIR,
  database: path.join(ROOT_DIR, "Database"),
  backups: path.join(ROOT_DIR, "Backups"),
  exports: path.join(ROOT_DIR, "Exports"),
  invoices: path.join(ROOT_DIR, "Invoices"),
  config: path.join(ROOT_DIR, "Config"),
  logs: path.join(ROOT_DIR, "Logs"),
};
const DB_FILE = path.join(DIRS.database, "kvm.db");

/**
 * Older builds shipped as "KVM Agencies" and stored data under that name.
 * If this is the first launch after upgrading from one of those builds -
 * the new data folder is empty but the old one has a database - copy it
 * over once so nobody loses their bills/products just from updating the
 * app. Never deletes the old folder, so this is always safe to re-run.
 */
function migrateFromPreviousBrand() {
  const oldRoot = path.join(app.getPath("appData"), "KVM Agencies");
  const oldDb = path.join(oldRoot, "Database", "kvm.db");
  if (fs.existsSync(DB_FILE) || !fs.existsSync(oldDb)) return;
  try {
    fs.cpSync(oldRoot, ROOT_DIR, { recursive: true });
    logLine(`Migrated data from previous "KVM Agencies" install at ${oldRoot}`);
  } catch (e) {
    logLine(`migrateFromPreviousBrand failed: ${e?.stack || e}`);
  }
}

for (const dir of Object.values(DIRS)) fs.mkdirSync(dir, { recursive: true });
migrateFromPreviousBrand();

const LOG_FILE = path.join(DIRS.logs, "main.log");
function logLine(line) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
  } catch {
    /* ignore logging failures */
  }
}
process.on("uncaughtException", (err) => logLine(`uncaughtException: ${err?.stack || err}`));
process.on("unhandledRejection", (err) => logLine(`unhandledRejection: ${err}`));

// ------------------------------------------------------------------- IPC

ipcMain.handle("kvm:loadDb", async () => {
  try {
    return await fsp.readFile(DB_FILE);
  } catch {
    return null;
  }
});

ipcMain.handle("kvm:saveDb", async (_evt, bytes) => {
  const tmp = DB_FILE + ".tmp";
  await fsp.writeFile(tmp, Buffer.from(bytes));
  await fsp.rename(tmp, DB_FILE);
});

ipcMain.handle("kvm:backupDb", async (_evt, bytes, name) => {
  const dest = path.join(DIRS.backups, path.basename(name));
  await fsp.writeFile(dest, Buffer.from(bytes));
  await pruneOldBackups();
  return dest;
});

ipcMain.handle("kvm:listBackups", async () => {
  const names = await fsp.readdir(DIRS.backups).catch(() => []);
  const out = [];
  for (const name of names) {
    const st = await fsp.stat(path.join(DIRS.backups, name)).catch(() => null);
    if (st) out.push({ name, size: st.size, created: st.mtime.toISOString() });
  }
  return out.sort((a, b) => (a.created < b.created ? 1 : -1));
});

ipcMain.handle("kvm:readBackup", async (_evt, name) => {
  try {
    return await fsp.readFile(path.join(DIRS.backups, path.basename(name)));
  } catch {
    return null;
  }
});

ipcMain.handle("kvm:openBackupFolder", async () => {
  await shell.openPath(DIRS.backups);
});

ipcMain.handle("kvm:dbPath", async () => DB_FILE);

ipcMain.handle("kvm:saveFile", async (_evt, name, bytes) => {
  const safeName = path.basename(name);
  const dest = path.join(DIRS.exports, safeName);
  await fsp.writeFile(dest, Buffer.from(bytes));
  return dest;
});

/** Keeps a generous cap of local backups on disk; the app also schedules its own 7-daily/4-weekly cadence. */
async function pruneOldBackups() {
  const names = await fsp.readdir(DIRS.backups).catch(() => []);
  const isSafety = (n) => n.startsWith("Unizo_SAFETY") || n.startsWith("KVM_SAFETY");
  const daily = names
    .filter((n) => (n.startsWith("Unizo_") || n.startsWith("KVM_")) && !isSafety(n))
    .sort();
  const excess = daily.length - 30;
  if (excess > 0) {
    for (const name of daily.slice(0, excess)) {
      await fsp.unlink(path.join(DIRS.backups, name)).catch(() => {});
    }
  }
}

// ------------------------------------------------------------ app server

/** Directory containing the built server/ and public/ folders (Nitro's node-server output). */
function outputDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "app-output")
    : path.join(__dirname, "..", ".output");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForServer(port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("The application server did not start in time."));
        else setTimeout(attempt, 150);
      });
      req.on("timeout", () => req.destroy());
    };
    attempt();
  });
}

let serverProcess = null;

async function startAppServer() {
  const outDir = outputDir();
  const entry = path.join(outDir, "server", "index.mjs");
  if (!fs.existsSync(entry)) {
    throw new Error(`Application files are missing (expected ${entry}). Please reinstall the application.`);
  }
  const port = await freePort();
  serverProcess = fork(entry, [], {
    cwd: outDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    silent: true,
  });
  serverProcess.stdout?.on("data", (d) => logLine(`[server] ${d.toString().trim()}`));
  serverProcess.stderr?.on("data", (d) => logLine(`[server:err] ${d.toString().trim()}`));
  serverProcess.on("exit", (code) => {
    if (code && code !== 0) logLine(`server process exited with code ${code}`);
    serverProcess = null;
  });
  await waitForServer(port);
  return port;
}

function stopAppServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// -------------------------------------------------------------- app window

let mainWindow = null;

async function createWindow() {
  let port;
  try {
    port = await startAppServer();
  } catch (e) {
    dialog.showErrorBox(
      "Unizo could not start",
      "The application could not start its local data service. Please reinstall the application, or contact the administrator.",
    );
    logLine(`startAppServer failed: ${e?.stack || e}`);
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    title: "Unizo",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  stopAppServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopAppServer);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
