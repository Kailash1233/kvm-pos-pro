import { useState } from "react";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/services/auth";
import { useApp } from "@/lib/app-context";

export function LoginScreen() {
  const { signIn, settings } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div>
          <div className="text-2xl font-semibold tracking-tight">{settings.businessName}</div>
          <p className="mt-2 max-w-sm text-sm text-sidebar-foreground/70">
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
        </form>
      </div>
    </div>
  );
}
