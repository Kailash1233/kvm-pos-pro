import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Truck, History as HistoryIcon, Eye } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { BillViewDialog } from "@/components/kvm/BillViewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatQty, fromQty } from "@/lib/money";
import {
  listCreditInvoiceEntries,
  creditInvoiceSummaryByProduct,
  creditInvoiceLog,
  deliverCreditInvoice,
  type CreditInvoiceStatus,
} from "@/lib/services/creditInvoices";
import { deliveryNoteHtml, printHtml } from "@/lib/services/print";

export const Route = createFileRoute("/credit-invoices")({
  head: () => ({
    meta: [
      { title: "Credit Invoices — Unizo Pending Deliveries" },
      {
        name: "description",
        content:
          "Track goods billed but not yet fully delivered: what's pending, for whom, and how much to buy.",
      },
    ],
  }),
  component: CreditInvoicesPage,
});

type StatusFilter = "OPEN" | CreditInvoiceStatus | "ALL";

function daysPending(billDate: string): number {
  const ms = Date.now() - new Date(billDate).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function CreditInvoicesPage() {
  const { user, settings } = useApp();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("OPEN");
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);
  const [deliverEntryId, setDeliverEntryId] = useState<number | null>(null);
  const [deliverQty, setDeliverQty] = useState("");
  const [printNote, setPrintNote] = useState(true);
  const [historyEntryId, setHistoryEntryId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useQueryData(
    () =>
      listCreditInvoiceEntries({
        status: status === "ALL" ? undefined : status,
        search: search || undefined,
        limit: 300,
      }),
    [status, search],
  );

  const summary = useQueryData(() => creditInvoiceSummaryByProduct(), []);
  const historyRows = useQueryData(
    () => (historyEntryId ? creditInvoiceLog(historyEntryId) : []),
    [historyEntryId],
  );
  const deliverEntry = rows?.find((r) => r.id === deliverEntryId) ?? null;
  const pendingDays = settings.creditInvoicePendingDays || 3;

  function openDeliver(entryId: number, pending: number) {
    setDeliverEntryId(entryId);
    setDeliverQty(String(fromQty(pending)));
    setPrintNote(true);
  }

  async function confirmDeliver() {
    if (!deliverEntry || !user) return;
    const qty = Number(deliverQty);
    if (!qty || qty <= 0) {
      toast.error("Enter the quantity being delivered.");
      return;
    }
    setBusy(true);
    try {
      const qtyScaled = Math.round(qty * 1000);
      deliverCreditInvoice(deliverEntry.id, qtyScaled, {
        refType: "MANUAL",
        user: user.full_name,
      });
      toast.success("Delivery recorded.");
      if (printNote) {
        const balance = deliverEntry.billed_qty - deliverEntry.delivered_qty - qtyScaled;
        printHtml(
          deliveryNoteHtml(
            {
              invoiceNumber: deliverEntry.invoice_number,
              customerName: deliverEntry.customer_name,
              customerPhone: deliverEntry.customer_phone,
              productName: deliverEntry.product_name,
              qtyDelivered: formatQty(qtyScaled),
              unit: deliverEntry.unit,
              balancePending: formatQty(Math.max(0, balance)),
            },
            settings,
          ),
        );
      }
      setDeliverEntryId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That delivery could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Credit Invoices"
        subtitle="Goods billed but not yet fully delivered - what's owed, to whom, and how much to buy"
      />
      <div className="space-y-4 p-6">
        {summary?.length ? (
          <div className="panel p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pending by product
            </h2>
            <div className="flex flex-wrap gap-2">
              {summary.map((s) => (
                <span
                  key={s.product_id}
                  className="rounded-full border border-border px-3 py-1 text-sm"
                >
                  {s.product_name} — {formatQty(s.pending_qty)} {s.unit} pending across{" "}
                  {s.customers} customer{s.customers === 1 ? "" : "s"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by bill no, customer or product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Pending / Partial</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PARTIAL">Partially Delivered</SelectItem>
              <SelectItem value="DELIVERED">Fully Delivered</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="ALL">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Bill No</th>
                <th className="px-2 py-2.5 text-left">Date</th>
                <th className="px-2 py-2.5 text-left">Customer</th>
                <th className="px-2 py-2.5 text-left">Phone</th>
                <th className="px-2 py-2.5 text-left">Product</th>
                <th className="px-2 py-2.5 text-right">Billed</th>
                <th className="px-2 py-2.5 text-right">Delivered</th>
                <th className="px-2 py-2.5 text-right">Pending</th>
                <th className="px-2 py-2.5 text-right">Days Pending</th>
                <th className="px-2 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-muted-foreground">
                    No Credit Invoice entries match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const pending = r.billed_qty - r.delivered_qty;
                  const open = r.status === "PENDING" || r.status === "PARTIAL";
                  const days = daysPending(r.bill_date);
                  const overdue = open && days > pendingDays;
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        <button
                          className="font-medium hover:underline"
                          onClick={() => setViewSaleId(r.sale_id)}
                        >
                          {r.invoice_number}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{r.bill_date}</td>
                      <td className="px-2 py-2">{r.customer_name}</td>
                      <td className="px-2 py-2 text-muted-foreground">{r.customer_phone}</td>
                      <td className="px-2 py-2">{r.product_name}</td>
                      <td className="num px-2 py-2">
                        {formatQty(r.billed_qty)} {r.unit}
                      </td>
                      <td className="num px-2 py-2">
                        {formatQty(r.delivered_qty)} {r.unit}
                      </td>
                      <td className="num px-2 py-2 font-medium">
                        {formatQty(pending)} {r.unit}
                      </td>
                      <td className={`num px-2 py-2 ${overdue ? "text-destructive" : ""}`}>
                        {open ? days : "-"}
                        {overdue ? " ⚠" : ""}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={
                            r.status === "DELIVERED"
                              ? "text-sm text-muted-foreground"
                              : r.status === "CANCELLED"
                                ? "text-sm text-muted-foreground line-through"
                                : "text-sm font-medium text-warning"
                          }
                        >
                          {r.status === "PARTIAL" ? "Partially Delivered" : r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          {open ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDeliver(r.id, pending)}
                            >
                              <Truck className="mr-1 h-3.5 w-3.5" /> Mark Delivered
                            </Button>
                          ) : null}
                          <Button size="sm" variant="ghost" onClick={() => setHistoryEntryId(r.id)}>
                            <HistoryIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewSaleId(r.sale_id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BillViewDialog saleId={viewSaleId} onClose={() => setViewSaleId(null)} />

      <Dialog open={!!deliverEntryId} onOpenChange={(o) => !o && setDeliverEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Delivered</DialogTitle>
          </DialogHeader>
          {deliverEntry ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {deliverEntry.product_name} for {deliverEntry.customer_name} — pending{" "}
                {formatQty(deliverEntry.billed_qty - deliverEntry.delivered_qty)}{" "}
                {deliverEntry.unit}
              </p>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Quantity delivered now
                </Label>
                <Input
                  className="num mt-1.5"
                  value={deliverQty}
                  onChange={(e) => setDeliverQty(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={printNote}
                  onChange={(e) => setPrintNote(e.target.checked)}
                />
                Print a delivery note
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliverEntryId(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void confirmDeliver()}>
              Confirm delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyEntryId} onOpenChange={(o) => !o && setHistoryEntryId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>History</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto text-sm">
            {!historyRows || historyRows.length === 0 ? (
              <p className="text-muted-foreground">No history yet.</p>
            ) : (
              historyRows.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b pb-1.5">
                  <span>
                    {h.event_type}
                    {h.qty ? ` — ${formatQty(Math.abs(h.qty))}` : ""}
                    {h.ref_type ? ` (${h.ref_type.toLowerCase()})` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
