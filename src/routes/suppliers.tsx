import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useApp, useQueryData } from "@/lib/app-context";
import { rupees, toPaise } from "@/lib/money";
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  supplierLedger,
  paySupplier,
  type SupplierWithBalance,
  type SupplierInput,
} from "@/lib/services/suppliers";
import { listPurchases } from "@/lib/services/purchases";
import type { PaymentMethod } from "@/lib/services/sales";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — KVM Agencies Purchase Ledger" },
      {
        name: "description",
        content: "Manage supplier accounts, outstanding dues, purchase history and payments made.",
      },
    ],
  }),
  component: SuppliersPage,
});

const EMPTY: SupplierInput = { name: "", phone: "", address: "", gstin: "", opening_balance: 0 };

function SuppliersPage() {
  const { refresh } = useApp();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SupplierWithBalance | "new" | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const rows = useQueryData(
    () => listSuppliers({ search: search || undefined, limit: 300 }),
    [search],
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Suppliers"
        subtitle={`${rows?.length ?? 0} suppliers shown`}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Supplier
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, phone or GSTIN"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-2 py-2.5 text-left">Phone</th>
                <th className="px-2 py-2.5 text-left">GSTIN</th>
                <th className="px-2 py-2.5 text-right">Outstanding</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    No suppliers match.
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <button
                        className="font-medium hover:underline"
                        onClick={() => setProfileId(s.id)}
                      >
                        {s.name}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{s.phone ?? "-"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{s.gstin ?? "-"}</td>
                    <td className="num px-2 py-2">
                      <span className={s.outstanding > 0 ? "text-warning" : ""}>
                        {rupees(s.outstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPayingId(s.id)}>
                          <Wallet className="mr-1 h-3.5 w-3.5" /> Pay
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupplierFormDialog
        value={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          refresh();
          setEditing(null);
        }}
      />
      <PaySupplierDialog supplierId={payingId} onClose={() => setPayingId(null)} onDone={refresh} />
      <SupplierProfileDialog supplierId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}

function SupplierFormDialog({
  value,
  onClose,
  onDone,
}: {
  value: SupplierWithBalance | "new" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (value === "new") setForm(EMPTY);
    else if (value) {
      setForm({
        name: value.name,
        phone: value.phone ?? "",
        address: value.address ?? "",
        gstin: value.gstin ?? "",
        opening_balance: value.opening_balance,
      });
    }
  }, [value]);

  if (!value) return null;
  const isNew = value === "new";

  function submit() {
    if (!user) return;
    setBusy(true);
    try {
      if (isNew) {
        createSupplier(form, user.full_name);
        toast.success("Supplier added.");
      } else if (value) {
        updateSupplier(value.id, form, user.full_name);
        toast.success("Supplier updated.");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this supplier.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Supplier" : "Edit Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Name</Label>
            <Input
              className="mt-1.5"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Phone</Label>
              <Input
                className="mt-1.5"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">GSTIN</Label>
              <Input
                className="mt-1.5"
                value={form.gstin ?? ""}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Address</Label>
            <Textarea
              rows={2}
              className="mt-1.5"
              value={form.address ?? ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Opening Balance
            </Label>
            <Input
              className="num mt-1.5"
              value={form.opening_balance || ""}
              onChange={(e) => setForm({ ...form, opening_balance: toPaise(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaySupplierDialog({
  supplierId,
  onClose,
  onDone,
}: {
  supplierId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const supplier = useQueryData(() => (supplierId ? getSupplier(supplierId) : null), [supplierId]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!supplierId) return null;

  function submit() {
    if (!user || !supplier) return;
    setBusy(true);
    try {
      paySupplier({
        supplierId: supplier.id,
        amount: toPaise(amount || 0),
        method,
        reference,
        notes,
        user: user.full_name,
      });
      toast.success("Payment recorded.");
      setAmount("");
      setReference("");
      setNotes("");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!supplierId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay Supplier — {supplier?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border p-3 text-sm">
            Current outstanding:{" "}
            <span className="font-semibold">{rupees(supplier?.outstanding ?? 0)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount
              </Label>
              <Input
                className="num mt-1.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Method
              </Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Reference Number
            </Label>
            <Input
              className="mt-1.5"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Notes</Label>
            <Textarea
              rows={2}
              className="mt-1.5"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Save Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplierProfileDialog({
  supplierId,
  onClose,
}: {
  supplierId: number | null;
  onClose: () => void;
}) {
  const supplier = useQueryData(() => (supplierId ? getSupplier(supplierId) : null), [supplierId]);
  const ledger = useQueryData(() => (supplierId ? supplierLedger(supplierId) : []), [supplierId]);
  const purchases = useQueryData(
    () => (supplierId ? listPurchases({ supplierId, limit: 50 }) : []),
    [supplierId],
  );

  if (!supplierId || !supplier) return null;

  return (
    <Dialog open={!!supplierId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{supplier.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              {supplier.phone ?? "-"}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">GSTIN</div>
              {supplier.gstin ?? "-"}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Purchases</div>
              {purchases?.length ?? 0}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <span className={supplier.outstanding > 0 ? "text-warning font-medium" : ""}>
                {rupees(supplier.outstanding)}
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Ledger</h3>
            <div className="panel max-h-56 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Reference</th>
                    <th className="px-2 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {!ledger || ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No ledger entries yet.
                      </td>
                    </tr>
                  ) : (
                    ledger.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.entry_date}</td>
                        <td className="px-2 py-1.5">{l.type}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{l.ref_label ?? "-"}</td>
                        <td className="num px-2 py-1.5">{l.debit ? rupees(l.debit) : "-"}</td>
                        <td className="num px-3 py-1.5">{l.credit ? rupees(l.credit) : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium">Purchase history</h3>
            <div className="panel max-h-40 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {!purchases || purchases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-muted-foreground">
                        No purchases recorded.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{p.purchase_date}</td>
                        <td className="px-2 py-1.5">{p.purchase_number}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">
                          {p.supplier_invoice ?? "-"}
                        </td>
                        <td className="num px-3 py-1.5">{rupees(p.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
