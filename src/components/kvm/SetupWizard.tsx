import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/app-context";
import { saveSettings } from "@/lib/services/settings";
import { createUser, login } from "@/lib/services/auth";
import { loadDemoData } from "@/lib/services/demo";
import { persist } from "@/lib/db/database";

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function SetupWizard() {
  const { completeSetup, signIn } = useApp();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [biz, setBiz] = useState({
    businessName: "KVM Agencies",
    address: "52, Kanchipuram High Road, Natham, Chengalpattu, Tamil Nadu 603002",
    phone: "",
    email: "",
    gstin: "33BAZPM1036Q1Z1",
    state: "Tamil Nadu",
    stateCode: "33",
    invoicePrefix: "KVM",
    invoiceFooter: "Goods once sold will not be taken back. Subject to Chengalpattu jurisdiction.",
  });
  const [owner, setOwner] = useState({ fullName: "", username: "owner", password: "", confirm: "" });
  const [withDemo, setWithDemo] = useState(true);

  function next() {
    setError(null);
    if (step === 1) {
      if (!biz.businessName.trim()) return setError("Please enter the shop name.");
      if (!biz.gstin.trim()) return setError("Please enter your GSTIN.");
      if (!GSTIN_RE.test(biz.gstin.trim().toUpperCase()))
        return setError("That GSTIN does not look correct. Please check all 15 characters.");
      if (!/^\d{2}$/.test(biz.stateCode)) return setError("State code must be two digits.");
    }
    setStep(step + 1);
  }

  async function finish() {
    setError(null);
    if (!owner.fullName.trim()) return setError("Please enter the owner's name.");
    if (!/^[A-Za-z0-9_.]{3,}$/.test(owner.username))
      return setError("Username needs at least 3 letters or numbers, with no spaces.");
    if (owner.password.length < 6) return setError("Password must be at least 6 characters.");
    if (owner.password !== owner.confirm) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      saveSettings({ ...biz, gstin: biz.gstin.trim().toUpperCase(), setupComplete: true });
      await createUser({
        username: owner.username.trim(),
        fullName: owner.fullName.trim(),
        role: "OWNER",
        password: owner.password,
        actor: owner.fullName.trim(),
      });
      if (withDemo) loadDemoData(owner.fullName.trim());
      await persist();
      const user = await login(owner.username.trim(), owner.password);
      completeSetup();
      signIn(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Setup could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary px-6 py-12">
      <div className="panel w-full max-w-2xl p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">First time setup</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This takes a minute and only happens once on this computer.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">Step {step} of 3</span>
        </div>

        {step === 1 ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Field label="Shop name" className="col-span-2">
              <Input
                value={biz.businessName}
                onChange={(e) => setBiz({ ...biz, businessName: e.target.value })}
              />
            </Field>
            <Field label="Address" className="col-span-2">
              <Textarea
                rows={2}
                value={biz.address}
                onChange={(e) => setBiz({ ...biz, address: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input value={biz.phone} onChange={(e) => setBiz({ ...biz, phone: e.target.value })} />
            </Field>
            <Field label="Email (optional)">
              <Input value={biz.email} onChange={(e) => setBiz({ ...biz, email: e.target.value })} />
            </Field>
            <Field label="GSTIN">
              <Input
                value={biz.gstin}
                onChange={(e) => setBiz({ ...biz, gstin: e.target.value.toUpperCase() })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="State" className="col-span-2">
                <Input value={biz.state} onChange={(e) => setBiz({ ...biz, state: e.target.value })} />
              </Field>
              <Field label="Code">
                <Input
                  value={biz.stateCode}
                  onChange={(e) => setBiz({ ...biz, stateCode: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Invoice number prefix">
              <Input
                value={biz.invoicePrefix}
                onChange={(e) => setBiz({ ...biz, invoicePrefix: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Note printed on every bill" className="col-span-2">
              <Textarea
                rows={2}
                value={biz.invoiceFooter}
                onChange={(e) => setBiz({ ...biz, invoiceFooter: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Field label="Owner name" className="col-span-2">
              <Input
                value={owner.fullName}
                onChange={(e) => setOwner({ ...owner, fullName: e.target.value })}
              />
            </Field>
            <Field label="Username">
              <Input
                value={owner.username}
                onChange={(e) => setOwner({ ...owner, username: e.target.value })}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={owner.password}
                onChange={(e) => setOwner({ ...owner, password: e.target.value })}
              />
            </Field>
            <Field label="Repeat password">
              <Input
                type="password"
                value={owner.confirm}
                onChange={(e) => setOwner({ ...owner, confirm: e.target.value })}
              />
            </Field>
            <p className="col-span-2 rounded-md bg-warning/15 px-3 py-2 text-sm">
              Write this password down somewhere safe. Nobody can recover it for you, because
              nothing is stored online.
            </p>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-start justify-between gap-6 rounded-md border border-border p-4">
              <div>
                <div className="font-medium">Start with sample data</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adds 30 building material items, 10 customers, 5 suppliers and a few example bills
                  so you can practise. You can clear it later from Settings.
                </p>
              </div>
              <Switch checked={withDemo} onCheckedChange={setWithDemo} />
            </div>
            <div className="rounded-md bg-secondary p-4 text-sm">
              <div className="font-medium">Ready to go</div>
              <p className="mt-1 text-muted-foreground">
                {biz.businessName} · GSTIN {biz.gstin} · Invoices start with {biz.invoicePrefix}
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 1 || busy}
          >
            Back
          </Button>
          {step < 3 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={finish} disabled={busy}>
              {busy ? "Setting up…" : "Finish setup"}
            </Button>
          )}
        </div>
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
