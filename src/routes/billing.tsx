import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Printer, Save, Search, Trash2, PauseCircle, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/app-context";
import { formatQty, fromQty, rupees, toPaise, toQty, toRupees } from "@/lib/money";
import {
  priceForCustomerType,
  searchProducts,
  type ProductWithStock,
} from "@/lib/services/products";
import { listCustomers, getCustomer, type CustomerWithBalance } from "@/lib/services/customers";
import { computeBill } from "@/lib/services/gst";
import {
  holdBill,
  listHeldBills,
  removeHeldBill,
  saveBill,
  getSale,
  type PaymentMethod,
} from "@/lib/services/sales";
import { maxDiscountPercent } from "@/lib/services/auth";
import { printInvoice } from "@/lib/services/print";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Billing — KVM Agencies GST Invoicing" },
      {
        name: "description",
        content:
          "Create GST bills fast with product search, customer credit, split payments and instant printing.",
      },
      { property: "og:title", content: "Billing — KVM Agencies GST Invoicing" },
      {
        property: "og:description",
        content: "Fast counter billing with GST, credit and split payments.",
      },
    ],
  }),
  component: Billing,
});

interface CartLine {
  product: ProductWithStock;
  qty: number; // milli-units
  price: number; // paise
  discount: number; // paise
}

function Billing() {
  const { user, settings, refresh, version } = useApp();
  const [customer, setCustomer] = useState<CustomerWithBalance | null>(null);
  const [customerTerm, setCustomerTerm] = useState("");
  const [showCustomers, setShowCustomers] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductWithStock[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [billDiscount, setBillDiscount] = useState("");
  const [payments, setPayments] = useState<Record<PaymentMethod, string>>({
    CASH: "",
    UPI: "",
    CARD: "",
    CREDIT: "",
    OTHER: "",
  });
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const held = useMemo(() => {
    try {
      return listHeldBills();
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setResults(searchProducts(term, { limit: 12 }));
        setHighlight(0);
      } catch {
        setResults([]);
      }
    }, 80);
    return () => window.clearTimeout(id);
  }, [term, version]);

  const customerMatches = useMemo(() => {
    if (!showCustomers) return [];
    try {
      return listCustomers({ search: customerTerm, limit: 8 });
    } catch {
      return [];
    }
  }, [customerTerm, showCustomers, version]);

  const interstate =
    !!customer?.state_code && !!settings.stateCode && customer.state_code !== settings.stateCode;

  const calc = useMemo(
    () =>
      computeBill(
        cart.map((l) => ({
          qty: l.qty,
          price: l.price,
          discount: l.discount,
          gstRate: l.product.gst_rate,
        })),
        {
          interstate,
          billDiscount: toPaise(billDiscount || 0),
          roundOff: settings.roundOff,
        },
      ),
    [cart, interstate, billDiscount, settings.roundOff],
  );

  const total = calc.totals.total;
  const entered = (Object.keys(payments) as PaymentMethod[]).reduce(
    (s, m) => s + toPaise(payments[m] || 0),
    0,
  );
  const remaining = total - entered;

  const addProduct = useCallback(
    (p: ProductWithStock) => {
      setCart((prev) => {
        const at = prev.findIndex((l) => l.product.id === p.id);
        if (at >= 0) {
          const next = [...prev];
          next[at] = { ...next[at]!, qty: next[at]!.qty + toQty(1) };
          return next;
        }
        return [
          ...prev,
          {
            product: p,
            qty: toQty(1),
            price: priceForCustomerType(p, (customer?.type as never) ?? "Retail"),
            discount: 0,
          },
        ];
      });
      setTerm("");
      searchRef.current?.focus();
    },
    [customer],
  );

  function updateLine(i: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function resetBill() {
    setCart([]);
    setCustomer(null);
    setCustomerTerm("");
    setBillDiscount("");
    setPayments({ CASH: "", UPI: "", CARD: "", CREDIT: "", OTHER: "" });
    setNotes("");
    setTerm("");
    searchRef.current?.focus();
  }

  const save = useCallback(
    async (print: boolean) => {
      if (!user) return;
      if (!cart.length) {
        toast.error("Add at least one product before saving.");
        return;
      }
      const limit = maxDiscountPercent(user.role);
      const discountPct = calc.totals.subtotal
        ? (calc.totals.discount / calc.totals.subtotal) * 100
        : 0;
      if (discountPct > limit) {
        toast.error(
          `Your role allows a maximum discount of ${limit}%. Please ask a manager to approve more.`,
        );
        return;
      }
      const list = (Object.keys(payments) as PaymentMethod[])
        .map((m) => ({ method: m, amount: toPaise(payments[m] || 0) }))
        .filter((p) => p.amount > 0);
      if (!list.length) list.push({ method: "CASH", amount: total });
      const sum = list.reduce((s, p) => s + p.amount, 0);
      if (sum !== total) {
        toast.error(
          `Payments add up to ${rupees(sum)} but the bill is ${rupees(total)}. Please correct the amounts.`,
        );
        return;
      }
      if (list.some((p) => p.method === "CREDIT") && !customer) {
        toast.error("Credit bills need a customer. Please choose the customer first.");
        return;
      }
      setBusy(true);
      try {
        const { saleId, invoiceNumber } = saveBill({
          customerId: customer?.id ?? null,
          billDiscount: toPaise(billDiscount || 0),
          lines: cart.map((l) => ({
            productId: l.product.id,
            qty: l.qty,
            price: l.price,
            discount: l.discount,
          })),
          payments: list,
          notes,
          user: user.full_name,
        });
        toast.success(`Bill ${invoiceNumber} saved`);
        if (print) {
          const s = getSale(saleId);
          if (s)
            printInvoice(
              {
                sale: s.sale,
                items: s.items,
                payments: s.payments,
                customer: customer
                  ? {
                      name: customer.name,
                      phone: customer.phone,
                      address: customer.address,
                      gstin: customer.gstin,
                    }
                  : null,
                outstanding: customer ? getCustomer(customer.id)?.outstanding : 0,
              },
              settings,
            );
        }
        resetBill();
        refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "The bill could not be saved.");
      } finally {
        setBusy(false);
      }
    },
    [cart, customer, payments, total, billDiscount, notes, user, settings, calc, refresh],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        void save(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        void save(false);
      } else if (e.key === "Escape") {
        setShowCustomers(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  function hold() {
    if (!cart.length || !user) return;
    holdBill(
      customer?.name ?? "Walk-in",
      {
        customerId: customer?.id ?? null,
        billDiscount,
        notes,
        lines: cart.map((l) => ({
          productId: l.product.id,
          qty: l.qty,
          price: l.price,
          discount: l.discount,
        })),
      },
      user.full_name,
    );
    toast.success("Bill kept on hold");
    resetBill();
    refresh();
  }

  function resume(id: number, payload: string) {
    try {
      const data = JSON.parse(payload) as {
        customerId: number | null;
        billDiscount: string;
        notes: string;
        lines: { productId: number; qty: number; price: number; discount: number }[];
      };
      const lines: CartLine[] = [];
      for (const l of data.lines) {
        const p = searchProducts("", { limit: 1000 }).find((x) => x.id === l.productId);
        if (p) lines.push({ product: p, qty: l.qty, price: l.price, discount: l.discount });
      }
      setCart(lines);
      setCustomer(data.customerId ? getCustomer(data.customerId) : null);
      setBillDiscount(data.billDiscount || "");
      setNotes(data.notes || "");
      removeHeldBill(id);
      refresh();
    } catch {
      toast.error("That held bill could not be opened.");
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Billing"
        subtitle="Search a product, press Enter to add. F8 saves, F9 saves and prints."
        actions={
          <>
            {held.length ? (
              <div className="flex items-center gap-2">
                {held.slice(0, 3).map((h) => (
                  <Button
                    key={h.id}
                    variant="secondary"
                    size="sm"
                    onClick={() => resume(h.id, h.payload)}
                  >
                    Resume {h.label}
                  </Button>
                ))}
              </div>
            ) : null}
            <Button variant="outline" onClick={hold} disabled={!cart.length}>
              <PauseCircle className="mr-1.5 h-4 w-4" /> Hold
            </Button>
            <Button variant="outline" onClick={resetBill} disabled={!cart.length}>
              <X className="mr-1.5 h-4 w-4" /> Clear
            </Button>
          </>
        }
      />

      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="relative">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Customer
                </Label>
                {customer ? (
                  <div className="mt-1.5 flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {customer.type} · Due {rupees(customer.outstanding)}
                        {customer.credit_limit
                          ? ` · Limit ${rupees(customer.credit_limit)}`
                          : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setCustomer(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      className="mt-1.5"
                      placeholder="Walk-in customer — type a name or phone"
                      value={customerTerm}
                      onChange={(e) => {
                        setCustomerTerm(e.target.value);
                        setShowCustomers(true);
                      }}
                      onFocus={() => setShowCustomers(true)}
                    />
                    {showCustomers && customerMatches.length ? (
                      <ul className="panel absolute z-20 mt-1 max-h-60 w-full overflow-auto p-1">
                        {customerMatches.map((c) => (
                          <li key={c.id}>
                            <button
                              className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-secondary"
                              onClick={() => {
                                setCustomer(c);
                                setShowCustomers(false);
                                setCustomerTerm("");
                                setCart((prev) =>
                                  prev.map((l) => ({
                                    ...l,
                                    price: priceForCustomerType(l.product, c.type as never),
                                  })),
                                );
                              }}
                            >
                              <span>
                                {c.name}
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {c.phone}
                                </span>
                              </span>
                              <span className="num text-xs text-muted-foreground">
                                {rupees(c.outstanding)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </div>

              <div className="relative">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Add product
                </Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    className="pl-9"
                    placeholder="Number, barcode or name"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlight((h) => Math.min(h + 1, results.length - 1));
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlight((h) => Math.max(h - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const p = results[highlight];
                        if (p) addProduct(p);
                      }
                    }}
                  />
                </div>
                {term && results.length ? (
                  <ul className="panel absolute z-20 mt-1 max-h-72 w-full overflow-auto p-1">
                    {results.map((p, i) => (
                      <li key={p.id}>
                        <button
                          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${
                            i === highlight ? "bg-secondary" : "hover:bg-secondary"
                          }`}
                          onMouseEnter={() => setHighlight(i)}
                          onClick={() => addProduct(p)}
                        >
                          <span>
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {p.product_number} · {p.brand ?? "-"} · GST {p.gst_rate}%
                            </span>
                          </span>
                          <span className="num text-xs">
                            {rupees(p.retail_price)}
                            <span
                              className={
                                p.stock <= 0
                                  ? "ml-2 text-destructive"
                                  : p.stock <= p.min_stock
                                    ? "ml-2 text-warning"
                                    : "ml-2 text-muted-foreground"
                              }
                            >
                              {formatQty(p.stock)} {p.unit}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left">Item</th>
                  <th className="px-2 py-2.5 text-right">Qty</th>
                  <th className="px-2 py-2.5 text-right">Rate</th>
                  <th className="px-2 py-2.5 text-right">Discount</th>
                  <th className="px-2 py-2.5 text-right">GST</th>
                  <th className="px-2 py-2.5 text-right">Amount</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                      No items yet. Search above and press Enter.
                    </td>
                  </tr>
                ) : (
                  cart.map((l, i) => {
                    const line = calc.lines[i]!;
                    const over = l.qty > l.product.stock;
                    return (
                      <tr key={l.product.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <div className="font-medium">{l.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.product.product_number} · in stock {formatQty(l.product.stock)}{" "}
                            {l.product.unit}
                            {over ? (
                              <span className="ml-2 text-warning">more than available</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="num h-9 w-24"
                            value={String(fromQty(l.qty))}
                            onChange={(e) => updateLine(i, { qty: toQty(e.target.value || 0) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="num h-9 w-24"
                            value={String(toRupees(l.price))}
                            onChange={(e) => updateLine(i, { price: toPaise(e.target.value || 0) })}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            className="num h-9 w-24"
                            value={String(toRupees(l.discount))}
                            onChange={(e) =>
                              updateLine(i, { discount: toPaise(e.target.value || 0) })
                            }
                          />
                        </td>
                        <td className="num px-2 py-2">
                          {l.product.gst_rate}%
                          <div className="text-xs text-muted-foreground">{rupees(line.tax)}</div>
                        </td>
                        <td className="num px-2 py-2 font-medium">{rupees(line.total)}</td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCart(cart.filter((_, idx) => idx !== i))}
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
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <h2 className="font-medium">Bill summary</h2>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row label="Items" value={String(cart.length)} />
              <Row label="Subtotal" value={rupees(calc.totals.subtotal)} />
              <Row label="Item discounts" value={`- ${rupees(calc.totals.itemDiscount)}`} />
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Bill discount</span>
                <Input
                  className="num h-8 w-28"
                  placeholder="0"
                  value={billDiscount}
                  onChange={(e) => setBillDiscount(e.target.value)}
                />
              </div>
              <Row label="Taxable value" value={rupees(calc.totals.taxable)} />
              {interstate ? (
                <Row label="IGST" value={rupees(calc.totals.igst)} />
              ) : (
                <>
                  <Row label="CGST" value={rupees(calc.totals.cgst)} />
                  <Row label="SGST" value={rupees(calc.totals.sgst)} />
                </>
              )}
              {calc.totals.roundOff ? (
                <Row label="Round off" value={rupees(calc.totals.roundOff)} />
              ) : null}
            </dl>
            <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">Grand total</span>
              <span className="num text-2xl font-semibold">{rupees(total)}</span>
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="font-medium">Payment</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["CASH", "UPI", "CARD", "CREDIT"] as PaymentMethod[]).map((m) => (
                <div key={m}>
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {m === "CREDIT" ? "On credit" : m}
                  </Label>
                  <Input
                    className="num mt-1 h-9"
                    placeholder="0"
                    value={payments[m]}
                    onChange={(e) => setPayments({ ...payments, [m]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPayments({
                    CASH: String(toRupees(total)),
                    UPI: "",
                    CARD: "",
                    CREDIT: "",
                    OTHER: "",
                  })
                }
              >
                Full cash
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setPayments({
                    CASH: "",
                    UPI: String(toRupees(total)),
                    CARD: "",
                    CREDIT: "",
                    OTHER: "",
                  })
                }
              >
                Full UPI
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!customer}
                onClick={() =>
                  setPayments({
                    CASH: "",
                    UPI: "",
                    CARD: "",
                    CREDIT: String(toRupees(total)),
                    OTHER: "",
                  })
                }
              >
                Full credit
              </Button>
            </div>
            <p
              className={`mt-3 text-sm ${
                remaining === 0 ? "text-muted-foreground" : "text-warning"
              }`}
            >
              {remaining === 0
                ? "Payments match the bill total."
                : remaining > 0
                  ? `${rupees(remaining)} still to be entered.`
                  : `${rupees(-remaining)} more than the bill total.`}
            </p>
            <Input
              className="mt-3"
              placeholder="Note on this bill (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="mt-4 grid gap-2">
              <Button size="lg" disabled={busy || !cart.length} onClick={() => void save(true)}>
                <Printer className="mr-2 h-4 w-4" /> Save &amp; print
                <span className="kbd-hint ml-2">F9</span>
              </Button>
              <Button
                variant="outline"
                disabled={busy || !cart.length}
                onClick={() => void save(false)}
              >
                <Save className="mr-2 h-4 w-4" /> Save only
                <span className="kbd-hint ml-2">F8</span>
              </Button>
            </div>
          </div>

          {held.length ? (
            <div className="panel p-4">
              <h2 className="flex items-center gap-2 font-medium">
                <PauseCircle className="h-4 w-4" /> Bills on hold
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {held.map((h) => (
                  <li key={h.id} className="flex items-center justify-between">
                    <span>{h.label}</span>
                    <Button variant="ghost" size="sm" onClick={() => resume(h.id, h.payload)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Open
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
