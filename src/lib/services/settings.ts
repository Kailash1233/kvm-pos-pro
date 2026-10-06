import { all, one, run, schedulePersist } from "../db/database";

export interface BusinessSettings {
  businessName: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  state: string;
  stateCode: string;
  invoicePrefix: string;
  invoiceFooter: string;
  currency: string;
  printFormat: "A4" | "THERMAL";
  lowStockAlerts: boolean;
  setupComplete: boolean;
  /** Data: URL (JPEG, resized client-side), shown in the sidebar and on invoices in place of the default mark. */
  logo: string | null;
  lastBackup: string;
  roundOff: boolean;
  /** Whether a new bill charges GST by default; the per-bill "Charge GST" toggle can always override it. */
  defaultGstApplied: boolean;
  /** Printed title for a non-GST bill, e.g. "ESTIMATE", "Cash Bill", "Delivery Bill". */
  estimateTitle: string;
  /** Invoice-number prefix for non-GST bills, kept in a separate numbering series from invoicePrefix. */
  estimatePrefix: string;
  /** Days a Credit Invoice entry can stay pending before it's highlighted as overdue. */
  creditInvoicePendingDays: number;
  /** Extra units the shop has added, on top of the built-in list. */
  customUnits: string[];
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  state: "",
  stateCode: "",
  invoicePrefix: "INV",
  invoiceFooter: "Goods once sold will not be taken back without prior approval.",
  currency: "INR",
  printFormat: "A4",
  lowStockAlerts: true,
  setupComplete: false,
  logo: null,
  lastBackup: "",
  roundOff: true,
  defaultGstApplied: false,
  estimateTitle: "ESTIMATE",
  estimatePrefix: "EST",
  creditInvoicePendingDays: 3,
  customUnits: [],
};

export function getSettings(): BusinessSettings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  const parse = <K extends keyof BusinessSettings>(k: K): BusinessSettings[K] => {
    const raw = map[k as string];
    if (raw === undefined) return DEFAULT_SETTINGS[k];
    try {
      return JSON.parse(raw) as BusinessSettings[K];
    } catch {
      return raw as BusinessSettings[K];
    }
  };
  const out = { ...DEFAULT_SETTINGS };
  (Object.keys(DEFAULT_SETTINGS) as (keyof BusinessSettings)[]).forEach((k) => {
    // @ts-expect-error index assignment across union values
    out[k] = parse(k);
  });
  return out;
}

export function setSetting<K extends keyof BusinessSettings>(
  key: K,
  value: BusinessSettings[K],
): void {
  run("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = ?", [
    key as string,
    JSON.stringify(value),
    JSON.stringify(value),
  ]);
  schedulePersist();
}

export function saveSettings(patch: Partial<BusinessSettings>): void {
  (Object.keys(patch) as (keyof BusinessSettings)[]).forEach((k) => {
    const v = patch[k];
    if (v !== undefined) setSetting(k, v as never);
  });
}

export function rawSetting(key: string): string | null {
  const r = one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return r?.value ?? null;
}

export function setRawSetting(key: string, value: string): void {
  run("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = ?", [
    key,
    value,
    value,
  ]);
  schedulePersist();
}
