import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Printer, Ban, Undo2, Search } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useApp, useQueryData } from "@/lib/app-context";
import { rupees, formatQty } from "@/lib/money";
import {
  listSales,
  getSale,
  cancelBill,
  saveSalesReturn,
  listReturns,
  type Sale,
} from "@/lib/services/sales";
import { getCustomer } from "@/lib/services/customers";
import { printInvoice } from "@/lib/services/print";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales — KVM Agencies Bill History & Returns" },
      {
        name: "description",
        content:
          "Search past bills, reprint invoices, cancel with authorization and process sales returns.",
      },
    ],
  }),
  component: SalesPage,
});

const RANGE_PRESETS = ["Today", "Yesterday", "This Week", "This Month", "Custom"] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function SalesPage() {
  const { user, settings, refresh, allowed } = useApp();
  const [preset, setPreset] = useState<(typeof RANGE_PRESETS)[number]>("Today");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  function applyPreset(p: (typeof RANGE_PRESETS)[number]) {
    setPreset(p);
    if (p === "Today") {
      setFrom(todayStr());
      setTo(todayStr());
    } else if (p === "Yesterday") {
      setFrom(daysAgo(1));
      setTo(daysAgo(1));
    } else if (p === "This Week") {
      setFrom(daysAgo(6));
      setTo(todayStr());
    } else if (p === "This Month") {
      setFrom(monthStartStr());
      setTo(todayStr());
    }
  }

  const rows = useQueryData(
    () => listSales({ from, to, search: search || undefined, limit: 200 }),
    [from, to, search],
  );
  const returns = useQueryData(() => listReturns(50), []);
  const viewing = useQueryData(() => (viewId ? getSale(viewId) : null), [viewId]);
  const viewingCustomer = useQueryData(
    () => (viewing?.sale.customer_id ? getCustomer(viewing.sale.customer_id) : null),
    [viewing?.sale.customer_id],
  );

  function doPrint(saleId: number) {
    const found = getSale(saleId);
    if (!found) return;
    const customer = found.sale.customer_id ? getCustomer(found.sale.customer_id) : null;
    printInvoice(
      {
        sale: found.sale,
        items: found.items,
        payments: found.payments,
        customer,
        outstanding: customer?.outstanding,
      },
      settings,
    );
  }

  function doCancel() {
    if (!cancelId || !user) return;
    if (!cancelReason.trim()) {
      toast.error("Please type the reason for cancelling this bill.");
      return;
    }
    try {
      cancelBill(cancelId, cancelReason.trim(), user.full_name);
      toast.success("Bill cancelled.");
      setCancelId(null);
      setCancelReason("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel this bill.");
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Sales" subtitle={`${rows?.length ?? 0} bills shown`} />
      <div className="p-6">
        <Tabs defaultValue="bills">
          <TabsList>
            <TabsTrigger value="bills">Bills</TabsTrigger>
            <TabsTrigger value="returns">Returns</TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {RANGE_PRESETS.map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={preset === p ? "default" : "outline"}
                  onClick={() => applyPreset(p)}
                >
                  {p}
                </Button>
              ))}
              {preset === "Custom" ? (
                <>
                  <Input
                    type="date"
                    className="w-40"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="date"
                    className="w-40"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </>
              ) : null}
              <div className="relative ml-auto w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Invoice number or customer"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="panel overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Invoice</th>
                    <th className="px-2 py-2.5 text-left">Date</th>
                    <th className="px-2 py-2.5 text-left">Customer</th>
                    <th className="px-2 py-2.5 text-left">Billed by</th>
                    <th className="px-2 py-2.5 text-left">Status</th>
                    <th className="px-2 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {!rows || rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                        No bills in this range.
                      </td>
                    </tr>
                  ) : (
                    rows.map((s) => (
                      <tr key={s.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{s.invoice_number}</td>
                        <td className="px-2 py-2 text-muted-foreground">{s.sale_date}</td>
                        <td className="px-2 py-2">{s.customer_name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{s.created_by}</td>
                        <td className="px-2 py-2">
                          {s.status === "CANCELLED" ? (
                            <span className="text-destructive">Cancelled</span>
                          ) : s.credit_amount > 0 ? (
                            <span className="text-warning">Part credit</span>
                          ) : (
                            <span className="text-success">Paid</span>
                          )}
                        </td>
                        <td className="num px-2 py-2">{rupees(s.total)}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              title="View"
                              onClick={() => setViewId(s.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Print / Reprint"
                              onClick={() => doPrint(s.id)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {s.status !== "CANCELLED" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Sales return"
                                onClick={() => setReturnSale(s)}
                              >
                                <Undo2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {s.status !== "CANCELLED" && allowed("bill.cancel") ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Cancel bill"
                                onClick={() => setCancelId(s.id)}
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="returns">
            <div className="panel overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Return No</th>
                    <th className="px-2 py-2.5 text-left">Date</th>
                    <th className="px-2 py-2.5 text-left">Invoice</th>
                    <th className="px-2 py-2.5 text-left">Customer</th>
                    <th className="px-2 py-2.5 text-left">Reason</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!returns || returns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">
                        No returns recorded yet.
                      </td>
                    </tr>
                  ) : (
                    returns.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium">{r.return_number}</td>
                        <td className="px-2 py-2 text-muted-foreground">{r.return_date}</td>
                        <td className="px-2 py-2">{r.invoice_number}</td>
                        <td className="px-2 py-2">{r.customer_name}</td>
                        <td className="px-2 py-2 text-muted-foreground">{r.reason ?? "-"}</td>
                        <td className="num px-4 py-2">{rupees(r.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* View bill */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.sale.invoice_number}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Customer: </span>
                  {viewing.sale.customer_name}
                </div>
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  {new Date(viewing.sale.created_at).toLocaleString("en-IN")}
                </div>
                <div>
                  <span className="text-muted-foreground">Billed by: </span>
                  {viewing.sale.created_by}
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  {viewing.sale.status}
                </div>
              </div>
              <div className="panel max-h-64 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.items.map((it) => (
                      <tr key={it.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          {it.product_number} · {it.product_name}
                        </td>
                        <td className="num px-2 py-1.5">
                          {formatQty(it.qty)} {it.unit}
                        </td>
                        <td className="num px-2 py-1.5">{rupees(it.price)}</td>
                        <td className="num px-3 py-1.5">{rupees(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between text-sm">
                <span>
                  Paid:{" "}
                  {viewing.payments.map((p) => `${p.method} ${rupees(p.amount)}`).join(", ") || "-"}
                </span>
                <span className="font-semibold">Total: {rupees(viewing.sale.total)}</span>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => viewId && doPrint(viewId)}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel bill */}
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this bill?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The bill will be marked cancelled, stock will be reversed and the customer ledger will
            be adjusted. This cannot be undone.
          </p>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason</Label>
            <Textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Back
            </Button>
            <Button variant="destructive" onClick={doCancel}>
              Cancel bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sales return */}
      <ReturnDialog sale={returnSale} onClose={() => setReturnSale(null)} onDone={refresh} />
    </div>
  );
}

function ReturnDialog({
  sale,
  onClose,
  onDone,
}: {
  sale: Sale | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const found = useQueryData(() => (sale ? getSale(sale.id) : null), [sale?.id]);
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!sale) return null;

  function submit() {
    if (!found || !user || !sale) return;
    const lines = Object.entries(qtys)
      .map(([id, q]) => ({ saleItemId: Number(id), qty: Math.round(parseFloat(q || "0") * 1000) }))
      .filter((l) => l.qty > 0);
    if (!lines.length) {
      toast.error("Enter the quantity being returned.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please choose/enter a reason for this return.");
      return;
    }
    setBusy(true);
    try {
      const num = saveSalesReturn({
        saleId: sale.id,
        reason: reason.trim(),
        lines,
        user: user.full_name,
      });
      toast.success(`Sales return ${num} recorded.`);
      setQtys({});
      setReason("");
      onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this return.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Return items from {sale.invoice_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="panel max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right">Sold qty</th>
                  <th className="px-3 py-2 text-right">Return qty</th>
                </tr>
              </thead>
              <tbody>
                {found?.items.map((it) => (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-3 py-1.5">{it.product_name}</td>
                    <td className="num px-2 py-1.5 text-muted-foreground">{formatQty(it.qty)}</td>
                    <td className="px-3 py-1.5">
                      <Input
                        className="num h-8 w-24 ml-auto"
                        value={qtys[it.id] ?? ""}
                        onChange={(e) => setQtys({ ...qtys, [it.id]: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1.5"
              placeholder="Damaged, wrong item, excess supply…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Save return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
