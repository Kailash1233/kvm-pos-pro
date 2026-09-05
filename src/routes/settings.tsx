import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { backupNow } from "@/lib/services/backup";

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
  const { settings, updateSettings, user } = useApp();
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The backup could not be created.");
    } finally {
      setBusy(false);
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
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
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
        <p className="text-sm text-muted-foreground md:col-span-2">
          Last backup: {settings.lastBackup ? new Date(settings.lastBackup).toLocaleString("en-IN") : "never"}
        </p>
      </div>
    </div>
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
