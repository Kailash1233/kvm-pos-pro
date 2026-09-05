import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  Package,
  Boxes,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import { LoginScreen } from "./LoginScreen";
import { SetupWizard } from "./SetupWizard";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard, key: "F1" },
  { to: "/billing", label: "Billing", icon: ReceiptText, key: "F2" },
  { to: "/products", label: "Products", icon: Package, key: "F3" },
  { to: "/stock", label: "Stock", icon: Boxes, key: "F4" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, key: "" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { ready, error, needsSetup, user, settings, signOut } = useApp();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = { F1: "/", F2: "/billing", F3: "/products", F4: "/stock" };
      const to = map[e.key];
      if (to) {
        e.preventDefault();
        void navigate({ to: to as "/" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (error) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold">The application could not start</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
      </Centered>
    );
  }

  if (!ready) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Opening your data file…</p>
      </Centered>
    );
  }

  if (needsSetup) return <SetupWizard />;
  if (!user) return <LoginScreen />;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-5 py-4">
          <div className="text-base font-semibold tracking-tight">{settings.businessName}</div>
          <div className="mt-0.5 text-xs text-sidebar-foreground/60">
            Offline retail &amp; materials
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to as "/"}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
                )}
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1">{n.label}</span>
                {n.key ? <span className="kbd-hint">{n.key}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 px-2 py-1 text-xs text-sidebar-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5" />
            {user.full_name} · {user.role}
          </div>
          <button
            onClick={signOut}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      {children}
    </div>
  );
}
