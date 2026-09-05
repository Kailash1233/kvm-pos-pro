// Runs in an isolated world with Node access, before the page loads.
// Exposes window.kvmDesktop exactly matching the DesktopBridge interface
// declared in src/lib/db/storage.ts - the renderer code doesn't know or
// care that it's now backed by real files instead of IndexedDB.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kvmDesktop", {
  loadDb: () => ipcRenderer.invoke("kvm:loadDb"),
  saveDb: (bytes) => ipcRenderer.invoke("kvm:saveDb", bytes),
  backupDb: (bytes, name) => ipcRenderer.invoke("kvm:backupDb", bytes, name),
  listBackups: () => ipcRenderer.invoke("kvm:listBackups"),
  readBackup: (name) => ipcRenderer.invoke("kvm:readBackup", name),
  openBackupFolder: () => ipcRenderer.invoke("kvm:openBackupFolder"),
  dbPath: () => ipcRenderer.invoke("kvm:dbPath"),
  saveFile: (name, bytes) => ipcRenderer.invoke("kvm:saveFile", name, bytes),
});
