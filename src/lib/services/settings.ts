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
  demoDataLoaded: boolean;
  lastBackup: string;
  roundOff: boolean;
}

export const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: "KVM Agencies",
  address: "52, Kanchipuram High Rd, Natham, Chengalpattu, Tamil Nadu 603002",
  phone: "",
  email: "",
  gstin: "33BAZPM1036Q1Z1",
  state: "Tamil Nadu",
  stateCode: "33",
  invoicePrefix: "KVM",
  invoiceFooter: "Goods once sold will not be taken back without prior approval.",
  currency: "INR",
  printFormat: "A4",
  lowStockAlerts: true,
  setupComplete: false,
  demoDataLoaded: false,
  lastBackup: "",
  roundOff: true,
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
