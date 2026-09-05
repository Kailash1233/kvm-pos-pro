import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { openDatabase, persist } from "./db/database";
import { getSettings, saveSettings, type BusinessSettings } from "./services/settings";
import { can, type AppUser, type Permission, type Role } from "./services/auth";
import { userCount } from "./services/auth";

interface AppState {
  ready: boolean;
  error: string | null;
  needsSetup: boolean;
  user: AppUser | null;
  settings: BusinessSettings;
  /** Increments whenever data changes so screens re-query. */
  version: number;
  refresh: () => void;
  signIn: (user: AppUser) => void;
  signOut: () => void;
  completeSetup: () => void;
  updateSettings: (patch: Partial<BusinessSettings>) => void;
  allowed: (p: Permission) => boolean;
  role: Role | undefined;
}

const Ctx = createContext<AppState | null>(null);

const SESSION_KEY = "kvm.session";

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [settings, setSettings] = useState<BusinessSettings>(getDefault());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await openDatabase();
        if (cancelled) return;
        const s = getSettings();
        setSettings(s);
        setNeedsSetup(!s.setupComplete || userCount() === 0);
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (cached) {
          try {
            setUser(JSON.parse(cached) as AppUser);
          } catch {
            sessionStorage.removeItem(SESSION_KEY);
          }
        }
        setReady(true);
      } catch (e) {
        console.error(e);
        setError(
          "The local data file could not be opened. Please restart the application, and contact the administrator if this continues.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void persist();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const refresh = useCallback(() => {
    setSettings(getSettings());
    setVersion((v) => v + 1);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      error,
      needsSetup,
      user,
      settings,
      version,
      refresh,
      signIn: (u) => {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
        setUser(u);
        setVersion((v) => v + 1);
      },
      signOut: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
      completeSetup: () => {
        setNeedsSetup(false);
        setSettings(getSettings());
      },
      updateSettings: (patch) => {
        saveSettings(patch);
        setSettings(getSettings());
      },
      allowed: (p) => can(user?.role, p),
      role: user?.role,
    }),
    [ready, error, needsSetup, user, settings, version, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function getDefault(): BusinessSettings {
  return {
    businessName: "KVM Agencies",
    address: "",
    phone: "",
    email: "",
    gstin: "",
    state: "Tamil Nadu",
    stateCode: "33",
    invoicePrefix: "KVM",
    invoiceFooter: "",
    currency: "INR",
    printFormat: "A4",
    lowStockAlerts: true,
    setupComplete: false,
    demoDataLoaded: false,
    lastBackup: "",
    roundOff: true,
  };
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/** Runs a database read and re-runs it whenever data changes. */
export function useQueryData<T>(fn: () => T, deps: unknown[] = []): T | null {
  const { ready, version } = useApp();
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!ready) return;
    try {
      setData(fn());
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, version, ...deps]);
  return data;
}
