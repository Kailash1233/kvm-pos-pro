import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recoverPassword } from "@/lib/services/auth";

/**
 * There is no email/SMS on a fully offline app, so "forgot password"
 * proves identity with the shop's own GSTIN instead - printed on every
 * invoice, so the real owner has it even if the app password slipped
 * their mind. This doesn't add a new weakness: anyone who already has
 * the computer could just as easily delete the whole database.
 */
export function RecoverPasswordPanel({
  usernames,
  onDone,
  onCancel,
}: {
  usernames: string[];
  onDone: (username: string) => void;
  onCancel: () => void;
}) {
  const [username, setUsername] = useState(usernames[0] ?? "");
  const [gstin, setGstin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username) return setError("Choose which account to reset.");
    if (!gstin.trim()) return setError("Enter this shop's GSTIN.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      await recoverPassword({ username, gstinConfirm: gstin, newPassword: password });
      onDone(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The password could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-6 py-12">
      <form onSubmit={submit} className="panel w-full max-w-sm p-8">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Reset your password</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          No email or phone is used by this app, so we confirm it's really your shop with your GSTIN
          instead - it's printed on every invoice you've given out.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label>Account to reset</Label>
            {usernames.length ? (
              <Select value={username} onValueChange={setUsername}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {usernames.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1.5 text-sm text-destructive">
                No active staff accounts were found in this data file.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="gstin">This shop's GSTIN</Label>
            <Input
              id="gstin"
              className="mt-1.5"
              placeholder="e.g. 33BAZPM1036Q1Z1"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <Label htmlFor="np">New password</Label>
            <Input
              id="np"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="cp">Repeat new password</Label>
            <Input
              id="cp"
              type="password"
              className="mt-1.5"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onCancel}>
            Back to sign in
          </Button>
          <Button type="submit" className="flex-1" disabled={busy || !usernames.length}>
            {busy ? "Resetting…" : "Reset password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
