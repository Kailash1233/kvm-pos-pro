import { useState } from "react";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, listActiveUsernames } from "@/lib/services/auth";
import { useApp } from "@/lib/app-context";
import { RecoverPasswordPanel } from "./RecoverPasswordPanel";
import { UnizoMark } from "./UnizoMark";

export function LoginScreen() {
  const { signIn, settings } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      signIn(await login(username, password));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (recovering) {
    return (
      <RecoverPasswordPanel
        usernames={listActiveUsernames()}
        onDone={(recoveredUsername) => {
          setUsername(recoveredUsername);
          setPassword("");
          setRecovering(false);
        }}
        onCancel={() => setRecovering(false)}
      />
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div>
          <div className="flex items-center gap-3">
            {settings.logo ? (
              <img src={settings.logo} alt="" className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <UnizoMark className="h-10 w-10" />
            )}
            <div className="text-2xl font-semibold tracking-tight">
              {settings.businessName || "Your business"}
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm text-sidebar-foreground/70">
            Billing, stock, purchases and accounts — all stored on this computer, with no internet
            needed.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-sidebar-foreground/70">
          <li>GST invoices with CGST, SGST and IGST</li>
          <li>Live stock and low stock alerts</li>
          <li>Customer and supplier balances</li>
          <li>Daily backups you keep yourself</li>
        </ul>
        <div className="text-xs text-sidebar-foreground/40">Unizo by Adszoo</div>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your staff username and password.</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="u">Username</Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="u"
                  className="pl-9"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="p"
                  type="password"
                  className="pl-9"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {message ? (
            <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {message}
            </p>
          ) : null}

          <Button type="submit" className="mt-6 w-full" size="lg" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
            onClick={() => setRecovering(true)}
          >
            Forgot your password?
          </button>
        </form>
      </div>
    </div>
  );
}
