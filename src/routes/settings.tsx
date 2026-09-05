import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, KeyRound, Plus, RotateCcw, Upload } from "lucide-react";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import {
  backupNow,
  listBackups,
  restoreBackup,
  importBackupFile,
  databaseLocation,
  openBackupFolder,
} from "@/lib/services/backup";
import {
  listUsers,
  createUser,
  setUserActive,
  changePassword,
  type AppUser,
  type Role,
} from "@/lib/services/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — KVM Agencies Shop & Bill Setup" },
      {
        name: "description",
        content:
          "Change shop details, GSTIN, invoice numbering, printing size and take a backup of your data.",
      },
      { property: "og:title", content: "Settings — KVM Agencies Shop & Bill Setup" },
      {
        property: "og:description",
        content: "Shop details, GSTIN, invoice numbering, print size and backups.",
      },
    ],
  }),
  component: Settings,
});

function Settings() {
  const { settings, updateSettings, user, allowed } = useApp();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [dbPath, setDbPath] = useState("");
  const [restoreName, setRestoreName] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [backupList, setBackupList] = useState<{ name: string; size: number; created: string }[]>(
    [],
  );

  async function refreshBackups() {
    setBackupList(await listBackups());
    setDbPath(await databaseLocation());
  }

  useEffect(() => {
    void refreshBackups();
  }, []);

  function save() {
    updateSettings(form);
    toast.success("Settings saved");
  }

  async function backup() {
    if (!user) return;
    setBusy(true);
    try {
      const path = await backupNow(user.full_name);
      toast.success(`Backup saved: ${path}`);
      await refreshBackups();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The backup could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function doOpenBackupFolder() {
    const opened = await openBackupFolder();
    if (!opened) toast.info("The backup folder can only be opened from the installed desktop app.");
  }

  async function doRestore(name: string) {
    if (!user) return;
    setBusy(true);
    try {
      await restoreBackup(name, user.full_name);
      toast.success("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That backup could not be restored.");
    } finally {
      setBusy(false);
      setRestoreName(null);
    }
  }

  async function doImportFile() {
    if (!user || !restoreFile) return;
    setBusy(true);
    try {
      const bytes = new Uint8Array(await restoreFile.arrayBuffer());
      await importBackupFile(bytes, user.full_name);
      toast.success("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That file could not be restored.");
    } finally {
      setBusy(false);
      setRestoreFile(null);
    }
  }

  const [users, setUsers] = useState<AppUser[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<AppUser | null>(null);

  function refreshUsers() {
    try {
      setUsers(listUsers());
    } catch {
      setUsers([]);
    }
  }

  useEffect(() => {
    refreshUsers();
  }, []);

  async function toggleUserActive(u: AppUser) {
    if (!user) return;
    if (u.id === user.id) {
      toast.error("You cannot disable your own account.");
      return;
    }
    try {
      setUserActive(u.id, !u.active, user.full_name);
      refreshUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That user could not be updated.");
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Settings"
        subtitle="Shop details printed on every bill"
        actions={
          <>
            <Button variant="outline" onClick={() => void backup()} disabled={busy}>
              {busy ? "Backing up…" : "Backup now"}
            </Button>
            <Button onClick={save}>Save changes</Button>
          </>
        }
      />
      <div className="grid max-w-3xl gap-4 p-6 md:grid-cols-2">
        <Field label="Shop name" className="md:col-span-2">
          <Input
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
          />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Textarea
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="GSTIN">
          <Input
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="State and code">
          <div className="flex gap-2">
            <Input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <Input
              className="num w-20"
              value={form.stateCode}
              onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Invoice prefix">
          <Input
            value={form.invoicePrefix}
            onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
          />
        </Field>
        <Field label="Bill size">
          <div className="flex gap-2">
            {(["A4", "THERMAL"] as const).map((f) => (
              <Button
                key={f}
                variant={form.printFormat === f ? "default" : "outline"}
                onClick={() => setForm({ ...form, printFormat: f })}
              >
                {f === "A4" ? "A4 sheet" : "80mm roll"}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Note printed on every bill" className="md:col-span-2">
          <Textarea
            rows={2}
            value={form.invoiceFooter}
            onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
          />
        </Field>
        <div className="flex items-center justify-between rounded-md border border-border p-4 md:col-span-2">
          <div>
            <div className="font-medium">Round bill totals to the nearest rupee</div>
            <p className="text-sm text-muted-foreground">
              Keeps cash handling simple at the counter.
            </p>
          </div>
          <Switch
            checked={form.roundOff}
            onCheckedChange={(v) => setForm({ ...form, roundOff: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-4 md:col-span-2">
          <div>
            <div className="font-medium">Warn about items running low</div>
            <p className="text-sm text-muted-foreground">Shows alerts on the home screen.</p>
          </div>
          <Switch
            checked={form.lowStockAlerts}
            onCheckedChange={(v) => setForm({ ...form, lowStockAlerts: v })}
          />
        </div>
      </div>

      {allowed("backup.restore") ? (
        <div className="max-w-3xl space-y-4 px-6 pb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Backup &amp; Data
          </h2>
          <div className="panel grid gap-3 p-4 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Database location</div>
              <div className="break-all">{dbPath || "…"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last backup</div>
              <div>
                {settings.lastBackup
                  ? new Date(settings.lastBackup).toLocaleString("en-IN")
                  : "never"}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Backups stored</div>
              <div>{backupList.length}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Button variant="outline" size="sm" onClick={() => void doOpenBackupFolder()}>
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Open backup folder
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-3.5 w-3.5" /> Restore from file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Backup file</th>
                  <th className="px-2 py-2.5 text-left">Created</th>
                  <th className="px-2 py-2.5 text-right">Size</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {backupList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      No backups yet. Click "Backup now" above to create the first one.
                    </td>
                  </tr>
                ) : (
                  backupList.map((b) => (
                    <tr key={b.name} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{b.name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{b.created}</td>
                      <td className="num px-2 py-2">{(b.size / 1024).toFixed(0)} KB</td>
                      <td className="px-4 py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setRestoreName(b.name)}>
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {allowed("users.manage") ? (
        <div className="max-w-3xl space-y-4 px-6 pb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Staff Accounts
            </h2>
            <Button size="sm" onClick={() => setAddUserOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add User
            </Button>
          </div>
          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-2 py-2.5 text-left">Username</th>
                  <th className="px-2 py-2.5 text-left">Role</th>
                  <th className="px-2 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{u.full_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{u.username}</td>
                    <td className="px-2 py-2">{u.role}</td>
                    <td className="px-2 py-2">
                      {u.active ? (
                        <span className="text-success">Active</span>
                      ) : (
                        <span className="text-muted-foreground">Disabled</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setPasswordUser(u)}>
                          <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Reset password
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void toggleUserActive(u)}>
                          {u.active ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <AddUserDialog
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onDone={() => {
          refreshUsers();
          setAddUserOpen(false);
        }}
      />
      <ResetPasswordDialog
        target={passwordUser}
        onClose={() => setPasswordUser(null)}
        actor={user?.full_name ?? ""}
      />

      <Dialog open={!!restoreName} onOpenChange={(o) => !o && setRestoreName(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This replaces all current data with the contents of <b>{restoreName}</b>. A safety copy
            of what you have right now will be taken first, but anything entered after this backup
            was made will be lost. The application will reload once this finishes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreName(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => restoreName && void doRestore(restoreName)}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!restoreFile} onOpenChange={(o) => !o && setRestoreFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from file?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This replaces all current data with the contents of <b>{restoreFile?.name}</b>. A safety
            copy of what you have right now will be taken first. The application will reload once
            this finishes.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreFile(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void doImportFile()}>
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddUserDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user: actor } = useApp();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setFullName("");
    setUsername("");
    setRole("CASHIER");
    setPassword("");
  }

  async function submit() {
    if (!actor) return;
    if (!fullName.trim() || !username.trim() || password.length < 6) {
      toast.error("Please fill in the name, username, and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await createUser({ username, fullName, role, password, actor: actor.full_name });
      toast.success("User created.");
      reset();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That user could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Staff Account</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Full name
            </Label>
            <Input
              className="mt-1.5"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Username
              </Label>
              <Input
                className="mt-1.5"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Temporary password
            </Label>
            <Input
              className="mt-1.5"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
  actor,
}: {
  target: AppUser | null;
  onClose: () => void;
  actor: string;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (!target) return null;

  async function submit() {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(target!.id, password, actor);
      toast.success("Password updated.");
      setPassword("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password — {target.full_name}</DialogTitle>
        </DialogHeader>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            New password
          </Label>
          <Input
            className="mt-1.5"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
