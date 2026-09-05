import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Eye, Plus, Trash2, Undo2, Search } from "lucide-react";
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
import { rupees, formatQty, toPaise, toQty, toRupees } from "@/lib/money";
import { searchProducts, type ProductWithStock } from "@/lib/services/products";
import { listSuppliers, type SupplierWithBalance } from "@/lib/services/suppliers";
import {
  savePurchase,
  savePurchaseReturn,
  listPurchases,
  getPurchase,
  type Purchase,
} from "@/lib/services/purchases";
import type { PaymentMethod } from "@/lib/services/sales";

export const Route = createFileRoute("/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases — KVM Agencies Stock-in & Supplier Bills" },
      {
        name: "description",
        content:
          "Record stock purchases from suppliers, update cost and supplier ledgers, and process purchase returns.",
      },
    ],
  }),
  component: PurchasesPage,
});

function PurchasesPage() {
  const { refresh } = useApp();
  const [newOpen, setNewOpen] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [search, setSearch] = useState("");

  const rows = useQueryData(
    () => listPurchases({ search: search || undefined, limit: 200 }),
    [search],
  );
  const viewing = useQueryData(() => (viewId ? getPurchase(viewId) : null), [viewId]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Purchases"
        subtitle={`${rows?.length ?? 0} purchases shown`}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Purchase
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Purchase number, supplier invoice or supplier"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Purchase No</th>
                <th className="px-2 py-2.5 text-left">Date</th>
                <th className="px-2 py-2.5 text-left">Supplier</th>
                <th className="px-2 py-2.5 text-left">Supplier Invoice</th>
                <th className="px-2 py-2.5 text-right">GST</th>
                <th className="px-2 py-2.5 text-right">Total</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No purchases yet. Click "New Purchase" to record stock coming in.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{p.purchase_number}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p.purchase_date}</td>
                    <td className="px-2 py-2">{p.supplier_name}</td>
                    <td className="px-2 py-2 text-muted-foreground">{p.supplier_invoice ?? "-"}</td>
                    <td className="num px-2 py-2">{rupees(p.cgst + p.sgst + p.igst)}</td>
                    <td className="num px-2 py-2">{rupees(p.total)}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="View"
                          onClick={() => setViewId(p.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Purchase return"
                          onClick={() => setReturnPurchase(p)}
                        >
                          <Undo2 className="h-4 w-4" />
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

      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.purchase.purchase_number}</DialogTitle>
          </DialogHeader>
          {viewing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Supplier: </span>
                  {viewing.purchase.supplier_name}
                </div>
                <div>
                  <span className="text-muted-foreground">Supplier invoice: </span>
                  {viewing.purchase.supplier_invoice ?? "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  {viewing.purchase.purchase_date}
                </div>
                <div>
                  <span className="text-muted-foreground">Paid: </span>
                  {rupees(viewing.purchase.paid)}
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
              <div className="text-right font-semibold">
                Total: {rupees(viewing.purchase.total)}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <NewPurchaseDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onDone={() => {
          refresh();
          setNewOpen(false);
        }}
      />
      <PurchaseReturnDialog
        purchase={returnPurchase}
        onClose={() => setReturnPurchase(null)}
        onDone={refresh}
      />
    </div>
  );
}

interface Line {
  product: ProductWithStock;
  qty: number; // milli-units
  price: number; // paise
  discount: number; // paise
}

function NewPurchaseDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const [supplier, setSupplier] = useState<SupplierWithBalance | null>(null);
  const [supplierTerm, setSupplierTerm] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const supplierMatches = useMemo(() => {
    if (!supplierTerm || supplier) return [];
    try {
      return listSuppliers({ search: supplierTerm, limit: 8 });
    } catch {
      return [];
    }
  }, [supplierTerm, supplier]);

  const productMatches = useMemo(() => {
    if (!term) return [];
    try {
      return searchProducts(term, { limit: 8 });
    } catch {
      return [];
    }
  }, [term]);

  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    let subtotal = 0;
    for (const l of lines) {
      const amount = Math.round((l.price * l.qty) / 1000);
      const t = Math.max(amount - l.discount, 0);
      taxable += t;
      tax += Math.round((t * l.product.gst_rate) / 100);
      subtotal += amount;
    }
    return { subtotal, taxable, tax, total: taxable + tax };
  }, [lines]);

  function addProduct(p: ProductWithStock) {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.product.id === p.id);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at]!, qty: next[at]!.qty + toQty(1) };
        return next;
      }
      return [...prev, { product: p, qty: toQty(1), price: p.purchase_price, discount: 0 }];
    });
    setTerm("");
  }

  function reset() {
    setSupplier(null);
    setSupplierTerm("");
    setInvoiceNo("");
    setLines([]);
    setPaid("");
    setNotes("");
    setTerm("");
  }

  function submit() {
    if (!user) return;
    if (!supplier) {
      toast.error("Please select the supplier.");
      return;
    }
    if (!lines.length) {
      toast.error("Add at least one product.");
      return;
    }
    setBusy(true);
    try {
      const { number } = savePurchase({
        supplierId: supplier.id,
        supplierInvoice: invoiceNo,
        date,
        lines: lines.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          price: l.price,
          discount: l.discount,
        })),
        amountPaid: toPaise(paid || 0),
        paymentMethod: method,
        notes,
        user: user.full_name,
      });
      toast.success(`Purchase ${number} saved. Stock updated.`);
      reset();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save this purchase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New Purchase</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative md:col-span-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Supplier
              </Label>
              {supplier ? (
                <div className="mt-1.5 flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="text-sm font-medium">{supplier.name}</div>
                  <Button variant="ghost" size="sm" onClick={() => setSupplier(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    className="mt-1.5"
                    placeholder="Type supplier name"
                    value={supplierTerm}
                    onChange={(e) => setSupplierTerm(e.target.value)}
                  />
                  {supplierMatches.length ? (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                      {supplierMatches.map((s) => (
                        <button
                          key={s.id}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => {
                            setSupplier(s);
                            setSupplierTerm("");
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Supplier Invoice #
              </Label>
              <Input
                className="mt-1.5"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input
                className="mt-1.5"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="relative">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Add product
            </Label>
            <Input
              className="mt-1.5"
              placeholder="Product number, barcode or name"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && productMatches[0]) addProduct(productMatches[0]);
              }}
            />
            {productMatches.length ? (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                {productMatches.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => addProduct(p)}
                  >
                    <span>
                      {p.product_number} · {p.name}
                    </span>
                    <span className="text-muted-foreground">{rupees(p.purchase_price)}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">GST</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No products added yet.
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => {
                    const amount = Math.round((l.price * l.qty) / 1000) - l.discount;
                    const total = amount + Math.round((amount * l.product.gst_rate) / 100);
                    return (
                      <tr key={l.product.id} className="border-t border-border">
                        <td className="px-3 py-1.5">{l.product.name}</td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="num h-8 w-20 ml-auto"
                            value={formatQty(l.qty)}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, qty: toQty(e.target.value) } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            className="num h-8 w-24 ml-auto"
                            value={toRupees(l.price)}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, price: toPaise(e.target.value) } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="num px-2 py-1.5 text-muted-foreground">
                          {l.product.gst_rate}%
                        </td>
                        <td className="num px-2 py-1.5">{rupees(total)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Amount paid now
                </Label>
                <Input
                  className="num mt-1.5 w-32"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Method
                </Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger className="mt-1.5 w-32">
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
            <div className="text-right text-sm">
              <div>Taxable: {rupees(totals.taxable)}</div>
              <div>GST: {rupees(totals.tax)}</div>
              <div className="text-lg font-semibold">Total: {rupees(totals.total)}</div>
              <div className="text-muted-foreground">
                Balance to supplier: {rupees(Math.max(totals.total - toPaise(paid || 0), 0))}
              </div>
            </div>
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
            Save purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchaseReturnDialog({
  purchase,
  onClose,
  onDone,
}: {
  purchase: Purchase | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const found = useQueryData(() => (purchase ? getPurchase(purchase.id) : null), [purchase?.id]);
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!purchase) return null;

  function submit() {
    if (!found || !user || !purchase) return;
    const lines = Object.entries(qtys)
      .map(([id, q]) => ({
        purchaseItemId: Number(id),
        qty: Math.round(parseFloat(q || "0") * 1000),
      }))
      .filter((l) => l.qty > 0);
    if (!lines.length) {
      toast.error("Enter the quantity being returned.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please enter a reason for this return.");
      return;
    }
    setBusy(true);
    try {
      const num = savePurchaseReturn({
        purchaseId: purchase.id,
        reason: reason.trim(),
        lines,
        user: user.full_name,
      });
      toast.success(`Purchase return ${num} recorded.`);
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
    <Dialog open={!!purchase} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Return items to {purchase.supplier_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="panel max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-right">Purchased qty</th>
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
              placeholder="Damaged, wrong item…"
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
