import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Wallet, FileDown, Printer } from "lucide-react";
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
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  customerLedger,
  customerPayments,
  receivePayment,
  type CustomerWithBalance,
  type CustomerInput,
  type CustomerType,
} from "@/lib/services/customers";
import { listSales } from "@/lib/services/sales";
import { exportCsv } from "@/lib/services/excel";
import { printHtml } from "@/lib/services/print";
import type { PaymentMethod } from "@/lib/services/sales";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "Customers — KVM Agencies Ledger & Credit" },
      {
        name: "description",
        content:
          "Manage customer accounts, credit limits, outstanding dues, payment collection and statements.",
      },
    ],
  }),
  component: CustomersPage,
});

const EMPTY: CustomerInput = {
  name: "",
  phone: "",
  address: "",
  gstin: "",
  type: "Retail",
  credit_limit: 0,
  opening_balance: 0,
};

function CustomersPage() {
  const { refresh } = useApp();
  const [search, setSearch] = useState("");
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [editing, setEditing] = useState<CustomerWithBalance | "new" | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);

  const rows = useQueryData(
    () => listCustomers({ search: search || undefined, outstandingOnly, limit: 300 }),
    [search, outstandingOnly],
  );

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Customers"
        subtitle={`${rows?.length ?? 0} customers shown`}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Customer
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, phone or GSTIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={outstandingOnly ? "default" : "outline"}
            onClick={() => setOutstandingOnly(!outstandingOnly)}
          >
            {outstandingOnly ? "Showing outstanding only" : "Show outstanding only"}
          </Button>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Name</th>
                <th className="px-2 py-2.5 text-left">Phone</th>
                <th className="px-2 py-2.5 text-left">Type</th>
                <th className="px-2 py-2.5 text-right">Credit Limit</th>
                <th className="px-2 py-2.5 text-right">Outstanding</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                    No customers match.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <button
                        className="font-medium hover:underline"
                        onClick={() => setProfileId(c.id)}
                      >
                        {c.name}
                      </button>
                      {!c.active ? (
                        <span className="ml-2 text-xs text-muted-foreground">Inactive</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{c.phone ?? "-"}</td>
                    <td className="px-2 py-2">{c.type}</td>
                    <td className="num px-2 py-2 text-muted-foreground">
                      {rupees(c.credit_limit)}
                    </td>
                    <td className="num px-2 py-2">
                      <span className={c.outstanding > 0 ? "text-warning" : ""}>
                        {rupees(c.outstanding)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setPayingId(c.id)}>
                          <Wallet className="mr-1 h-3.5 w-3.5" /> Receive
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
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

      <CustomerFormDialog
        value={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          refresh();
          setEditing(null);
        }}
      />
      <ReceivePaymentDialog
        customerId={payingId}
        onClose={() => setPayingId(null)}
        onDone={refresh}
      />
      <CustomerProfileDialog customerId={profileId} onClose={() => setProfileId(null)} />
    </div>
  );
}

function CustomerFormDialog({
  value,
  onClose,
  onDone,
}: {
  value: CustomerWithBalance | "new" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (value === "new") setForm(EMPTY);
    else if (value) {
      setForm({
        name: value.name,
        phone: value.phone ?? "",
        address: value.address ?? "",
        gstin: value.gstin ?? "",
        type: value.type,
        credit_limit: value.credit_limit,
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
        createCustomer(form, user.full_name);
        toast.success("Customer added.");
      } else if (value) {
        updateCustomer(value.id, form, user.full_name);
        toast.success("Customer updated.");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this customer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Customer" : "Edit Customer"}</DialogTitle>
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
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Customer Type
              </Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CustomerType })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Walk-in">Walk-in</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Contractor">Contractor</SelectItem>
                  <SelectItem value="Dealer">Dealer</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">GSTIN</Label>
              <Input
                className="mt-1.5"
                value={form.gstin ?? ""}
                onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Credit Limit
              </Label>
              <Input
                className="num mt-1.5"
                value={form.credit_limit || ""}
                onChange={(e) => setForm({ ...form, credit_limit: toPaise(e.target.value) })}
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

function ReceivePaymentDialog({
  customerId,
  onClose,
  onDone,
}: {
  customerId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const customer = useQueryData(() => (customerId ? getCustomer(customerId) : null), [customerId]);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  if (!customerId) return null;

  function submit() {
    if (!user || !customer) return;
    setBusy(true);
    try {
      receivePayment({
        customerId: customer.id,
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
    <Dialog open={!!customerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Payment — {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-border p-3 text-sm">
            Current outstanding:{" "}
            <span className="font-semibold">{rupees(customer?.outstanding ?? 0)}</span>
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

function CustomerProfileDialog({
  customerId,
  onClose,
}: {
  customerId: number | null;
  onClose: () => void;
}) {
  const customer = useQueryData(() => (customerId ? getCustomer(customerId) : null), [customerId]);
  const ledger = useQueryData(() => (customerId ? customerLedger(customerId) : []), [customerId]);
  const payments = useQueryData(
    () => (customerId ? customerPayments(customerId) : []),
    [customerId],
  );
  const sales = useQueryData(
    () => (customerId ? listSales({ customerId, limit: 50 }) : []),
    [customerId],
  );

  if (!customerId || !customer) return null;

  function statementRows() {
    return (ledger ?? []).map((l) => ({
      Date: l.entry_date,
      Type: l.type,
      Reference: l.ref_label ?? "",
      Debit: l.debit ? (l.debit / 100).toFixed(2) : "",
      Credit: l.credit ? (l.credit / 100).toFixed(2) : "",
      Notes: l.notes ?? "",
    }));
  }

  function printStatement() {
    const rows = statementRows();
    let running = customer!.opening_balance;
    const body = rows
      .map((r) => {
        const debit = r.Debit ? Number(r.Debit) * 100 : 0;
        const credit = r.Credit ? Number(r.Credit) * 100 : 0;
        running += debit - credit;
        return `<tr><td>${r.Date}</td><td>${r.Type}</td><td>${r.Reference}</td>
          <td class="n">${r.Debit}</td><td class="n">${r.Credit}</td><td class="n">${(running / 100).toFixed(2)}</td></tr>`;
      })
      .join("");
    printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Statement - ${customer!.name}</title>
      <style>body{font-family:sans-serif;font-size:12px;padding:16px}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #999;padding:4px 6px} th{background:#eee}
      .n{text-align:right}</style></head><body>
      <h2>${customer!.name}</h2>
      <div>Phone: ${customer!.phone ?? "-"} | GSTIN: ${customer!.gstin ?? "-"}</div>
      <div>Opening balance: ₹${(customer!.opening_balance / 100).toFixed(2)}</div>
      <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
      <tbody>${body}</tbody></table>
      <p><b>Closing outstanding: ₹${(customer!.outstanding / 100).toFixed(2)}</b></p>
      </body></html>`);
  }

  return (
    <Dialog open={!!customerId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{customer.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              {customer.type}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              {customer.phone ?? "-"}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Bills</div>
              {sales?.length ?? 0}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
              <span className={customer.outstanding > 0 ? "text-warning font-medium" : ""}>
                {rupees(customer.outstanding)}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-medium">Ledger / Statement</h3>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={printStatement}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void exportCsv(`${customer.name}-statement.csv`, statementRows())}
                >
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                </Button>
              </div>
            </div>
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
            <h3 className="mb-1 text-sm font-medium">Recent payments</h3>
            <div className="panel max-h-40 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {!payments || payments.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-muted-foreground">
                        No payments recorded.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          {new Date(p.paid_at).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-2 py-1.5">{p.method}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.reference ?? "-"}</td>
                        <td className="num px-3 py-1.5">{rupees(p.amount)}</td>
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
