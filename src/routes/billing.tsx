import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  PauseCircle,
  X,
  Boxes,
  Droplets,
  Layers,
  PaintBucket,
  Zap,
  Wrench,
  ShowerHead,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { ProductImage } from "@/components/kvm/ProductImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import { formatQty, fromQty, rupees, toPaise, toQty, toRupees } from "@/lib/money";
import {
  priceForCustomerType,
  searchProducts,
  listProducts,
  listCategories,
  type ProductWithStock,
} from "@/lib/services/products";
import { listCustomers, getCustomer, type CustomerWithBalance } from "@/lib/services/customers";
import { freeStock, pendingDeliveriesForSale } from "@/lib/services/creditInvoices";
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
      { title: "Billing — Unizo GST Invoicing" },
      {
        name: "description",
        content:
          "Create GST bills fast with product search, customer credit, split payments and instant printing.",
      },
      { property: "og:title", content: "Billing — Unizo GST Invoicing" },
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
  qty: number; // milli-units - decimals allowed for any unit
  price: number; // paise
  discount: number; // paise
}

/**
 * Old-school billing convention: typing "3*cement" (or "3x...") in the
 * search box searches for "cement" but adds 3 of whatever gets picked,
 * so a cashier never has to touch the qty box for a multi-unit sale.
 */
function parseQtyPrefix(raw: string): { qty: number; query: string } {
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*[x*]\s*(.+)$/i);
  const qty = m ? Number(m[1]) : NaN;
  return qty > 0 ? { qty, query: m![2]! } : { qty: 1, query: raw };
}

function Billing() {
  const { user, settings, refresh, version } = useApp();
  const [customer, setCustomer] = useState<CustomerWithBalance | null>(null);
  const [customerTerm, setCustomerTerm] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showCustomers, setShowCustomers] = useState(false);
  const [customerHighlight, setCustomerHighlight] = useState(0);
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
  const [transportCharge, setTransportCharge] = useState("");
  const [gstApplied, setGstApplied] = useState(settings.defaultGstApplied);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const customerRef = useRef<HTMLInputElement>(null);

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
        setResults(searchProducts(parseQtyPrefix(term).query, { limit: 12 }));
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

  useEffect(() => {
    setCustomerHighlight(0);
  }, [customerMatches]);

  const interstate =
    !!customer?.state_code && !!settings.stateCode && customer.state_code !== settings.stateCode;

  const calc = useMemo(
    () =>
      computeBill(
        cart.map((l) => ({
          qty: l.qty,
          price: l.price,
          discount: l.discount,
          gstRate: gstApplied ? l.product.gst_rate : 0,
        })),
        {
          interstate,
          billDiscount: toPaise(billDiscount || 0),
          roundOff: settings.roundOff,
        },
      ),
    [cart, interstate, billDiscount, settings.roundOff, gstApplied],
  );

  // Transport is added after GST, never taxed - same treatment as round-off.
  const total = calc.totals.total + toPaise(transportCharge || 0);
  const entered = (Object.keys(payments) as PaymentMethod[]).reduce(
    (s, m) => s + toPaise(payments[m] || 0),
    0,
  );
  const remaining = total - entered;

  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);

  // Qty/Rate/Discount are controlled from the authoritative fixed-point
  // number, which rounds on every keystroke - without this, typing a
  // decimal character by character (e.g. "1.5") gets its "." silently
  // rounded away after the first keystroke and collapses into "15". While a
  // cell is being actively typed into, show exactly what was typed instead;
  // only the authoritative value takes over again once the cell blurs.
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  function cellValue(key: string, derived: string) {
    return cellDrafts[key] ?? derived;
  }
  function onCellChange(key: string, raw: string, commit: (v: string) => void) {
    setCellDrafts((d) => ({ ...d, [key]: raw }));
    commit(raw);
  }
  function onCellBlur(key: string) {
    setCellDrafts((d) => {
      if (!(key in d)) return d;
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  const addProduct = useCallback(
    (p: ProductWithStock, qty: number = toQty(1)) => {
      setCart((prev) => {
        const at = prev.findIndex((l) => l.product.id === p.id);
        if (at >= 0) {
          const next = [...prev];
          next[at] = { ...next[at]!, qty: next[at]!.qty + qty };
          setPendingFocusIndex(at);
          return next;
        }
        setPendingFocusIndex(prev.length);
        return [
          ...prev,
          {
            product: p,
            qty,
            price: priceForCustomerType(p, (customer?.type as never) ?? "Retail"),
            discount: 0,
          },
        ];
      });
      setTerm("");
    },
    [customer],
  );

  // A product was just added - the new row doesn't exist in the DOM yet at
  // the moment addProduct ran, so focus it (with its value selected, ready
  // to overtype) once this render has actually put it on the page.
  useEffect(() => {
    if (pendingFocusIndex === null) return;
    const el = document.getElementById(`cart-qty-${pendingFocusIndex}`) as HTMLInputElement | null;
    if (el) {
      el.focus();
      el.select();
    } else {
      searchRef.current?.focus();
    }
    setPendingFocusIndex(null);
  }, [pendingFocusIndex, cart]);

  const selectCustomer = useCallback((c: CustomerWithBalance) => {
    setCustomer(c);
    setShowCustomers(false);
    setCustomerTerm("");
    setCustomerPhone("");
    setCart((prev) =>
      prev.map((l) => ({ ...l, price: priceForCustomerType(l.product, c.type as never) })),
    );
    searchRef.current?.focus();
  }, []);

  /**
   * Cash/UPI/Card are what the customer actually handed over; Credit is
   * whatever's left. Typing into any of the first three auto-fills Credit
   * with the remainder, since most bills here are part-payment + credit.
   * Credit itself stays freely editable - the auto-fill is just a default.
   */
  function setPaymentAmount(method: PaymentMethod, raw: string) {
    setPayments((prev) => {
      const next = { ...prev, [method]: raw };
      if (method !== "CREDIT") {
        const others = toPaise(next.CASH || 0) + toPaise(next.UPI || 0) + toPaise(next.CARD || 0);
        const remainder = Math.max(0, total - others);
        next.CREDIT = remainder > 0 ? String(toRupees(remainder)) : "";
      }
      return next;
    });
  }

  function updateLine(i: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  /**
   * Excel-style keyboard nav for the cart grid: Up/Down moves to the same
   * column in the next/previous row, Esc jumps straight back to search.
   * Enter in Qty/Weight goes straight back to search (that's the fast path:
   * search -> add -> type qty -> Enter -> next product); Enter in Rate or
   * Discount still moves right (Rate -> Discount -> back to search).
   */
  const CART_COLS = ["qty", "rate", "discount"] as const;
  function cartCellKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    row: number,
    col: (typeof CART_COLS)[number],
  ) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      document.getElementById(`cart-${col}-${row + 1}`)?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (row === 0) searchRef.current?.focus();
      else document.getElementById(`cart-${col}-${row - 1}`)?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (col === "qty") {
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      const nextCol = CART_COLS[CART_COLS.indexOf(col) + 1];
      if (nextCol) document.getElementById(`cart-${nextCol}-${row}`)?.focus();
      else searchRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef.current?.focus();
    }
  }

  function resetBill() {
    setCart([]);
    setCellDrafts({});
    setCustomer(null);
    setCustomerTerm("");
    setCustomerPhone("");
    setBillDiscount("");
    setTransportCharge("");
    setPayments({ CASH: "", UPI: "", CARD: "", CREDIT: "", OTHER: "" });
    setNotes("");
    setTerm("");
    setGstApplied(settings.defaultGstApplied);
    searchRef.current?.focus();
  }

  /**
   * The one thing standing between this bill and a save, computed live so
   * it can be shown as soon as it's true - not just after the cashier
   * tries to save and gets turned away.
   */
  const blockingIssue = useMemo(() => {
    if (!cart.length || !user) return null;
    const limit = maxDiscountPercent(user.role);
    const discountPct = calc.totals.subtotal
      ? (calc.totals.discount / calc.totals.subtotal) * 100
      : 0;
    if (discountPct > limit) {
      return `Your role allows a maximum discount of ${limit}%. Please ask a manager to approve more.`;
    }
    const entered = (Object.keys(payments) as PaymentMethod[])
      .map((m) => ({ method: m, amount: toPaise(payments[m] || 0) }))
      .filter((p) => p.amount > 0);
    const sum = entered.reduce((s, p) => s + p.amount, 0);
    if (entered.length && sum !== total) {
      return `Payments add up to ${rupees(sum)} but the bill is ${rupees(total)}. Please correct the amounts.`;
    }
    if (entered.some((p) => p.method === "CREDIT") && !customer) {
      return "Credit bills need a customer. Please choose the customer first.";
    }
    const hasPendingLine = cart.some((l) => l.qty - freeStock(l.product.id, l.product.stock) > 0);
    const resolvedPhoneOk = customer ? !!customer.phone : !!customerPhone.trim();
    const resolvedNameOk = customer ? !!customer.name : !!customerTerm.trim();
    if (hasPendingLine && (!resolvedNameOk || !resolvedPhoneOk)) {
      return "Some items here go to a Credit Invoice for the missing stock - please enter the customer's name and phone number first.";
    }
    return null;
  }, [
    cart,
    payments,
    total,
    calc.totals.subtotal,
    calc.totals.discount,
    user,
    customer,
    customerPhone,
    customerTerm,
  ]);

  const save = useCallback(
    async (print: boolean) => {
      if (!user) return;
      if (!cart.length) {
        toast.error("Add at least one product before saving.");
        return;
      }
      if (blockingIssue) return;
      const list = (Object.keys(payments) as PaymentMethod[])
        .map((m) => ({ method: m, amount: toPaise(payments[m] || 0) }))
        .filter((p) => p.amount > 0);
      if (!list.length) list.push({ method: "CASH", amount: total });
      setBusy(true);
      try {
        const { saleId, invoiceNumber } = saveBill({
          customerId: customer?.id ?? null,
          customerName: customer ? undefined : customerTerm,
          customerPhone: customer ? undefined : customerPhone,
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
          gstApplied,
          transportCharge: toPaise(transportCharge || 0),
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
                pendingDeliveries: pendingDeliveriesForSale(saleId),
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
    [
      cart,
      customer,
      customerTerm,
      customerPhone,
      payments,
      total,
      billDiscount,
      transportCharge,
      notes,
      user,
      settings,
      calc,
      refresh,
      gstApplied,
      blockingIssue,
    ],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F9") {
        e.preventDefault();
        void save(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        void save(false);
      } else if (e.key === "F5") {
        e.preventDefault();
        setCustomer(null);
        setTimeout(() => customerRef.current?.focus(), 0);
      } else if (e.key === "F6") {
        e.preventDefault();
        hold();
      } else if (e.key === "F7") {
        e.preventDefault();
        resetBill();
      } else if (e.altKey && e.key === "1") {
        e.preventDefault();
        setPayments({ CASH: String(toRupees(total)), UPI: "", CARD: "", CREDIT: "", OTHER: "" });
      } else if (e.altKey && e.key === "2") {
        e.preventDefault();
        setPayments({ CASH: "", UPI: String(toRupees(total)), CARD: "", CREDIT: "", OTHER: "" });
      } else if (e.altKey && e.key === "3") {
        if (!customer) return;
        e.preventDefault();
        setPayments({ CASH: "", UPI: "", CARD: "", CREDIT: String(toRupees(total)), OTHER: "" });
      } else if (e.key === "Escape") {
        setShowCustomers(false);
        setTerm("");
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, total, customer]);

  function hold() {
    if (!cart.length || !user) return;
    holdBill(
      customer?.name ?? customerTerm ?? "Walk-in",
      {
        customerId: customer?.id ?? null,
        customerName: customer ? undefined : customerTerm,
        customerPhone: customer ? undefined : customerPhone,
        billDiscount,
        transportCharge,
        notes,
        gstApplied,
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
        customerName?: string;
        customerPhone?: string;
        billDiscount: string;
        transportCharge?: string;
        notes: string;
        gstApplied?: boolean;
        lines: { productId: number; qty: number; price: number; discount: number }[];
      };
      const lines: CartLine[] = [];
      for (const l of data.lines) {
        const p = searchProducts("", { limit: 1000 }).find((x) => x.id === l.productId);
        if (p) lines.push({ product: p, qty: l.qty, price: l.price, discount: l.discount });
      }
      setCart(lines);
      setCustomer(data.customerId ? getCustomer(data.customerId) : null);
      setCustomerTerm(data.customerId ? "" : data.customerName || "");
      setCustomerPhone(data.customerId ? "" : data.customerPhone || "");
      setBillDiscount(data.billDiscount || "");
      setTransportCharge(data.transportCharge || "");
      setNotes(data.notes || "");
      setGstApplied(data.gstApplied ?? settings.defaultGstApplied);
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
        subtitle="Search a product, press Enter to add. Press ? for every shortcut, start to print."
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
              <span className="kbd-hint ml-2">F6</span>
            </Button>
            <Button variant="outline" onClick={resetBill} disabled={!cart.length}>
              <X className="mr-1.5 h-4 w-4" /> Clear
              <span className="kbd-hint ml-2">F7</span>
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
                  Customer <span className="kbd-hint ml-1">F5</span>
                </Label>
                {customer ? (
                  <div className="mt-1.5 flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {customer.type} · Due {rupees(customer.outstanding)}
                        {customer.credit_limit ? ` · Limit ${rupees(customer.credit_limit)}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomer(null);
                        setTimeout(() => customerRef.current?.focus(), 0);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      ref={customerRef}
                      className="mt-1.5"
                      placeholder="Walk-in customer — type a name or phone"
                      value={customerTerm}
                      onChange={(e) => {
                        setCustomerTerm(e.target.value);
                        setShowCustomers(true);
                      }}
                      onFocus={() => setShowCustomers(true)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setCustomerHighlight((h) => Math.min(h + 1, customerMatches.length - 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setCustomerHighlight((h) => Math.max(h - 1, 0));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const c = customerMatches[customerHighlight];
                          if (c) selectCustomer(c);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setShowCustomers(false);
                          setCustomerTerm("");
                          searchRef.current?.focus();
                        }
                      }}
                    />
                    <Input
                      className="mt-1.5"
                      placeholder="Phone (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      In a hurry? Leave both blank — the bill saves as a plain walk-in sale, no name
                      printed.
                    </p>
                    {showCustomers && customerMatches.length ? (
                      <ul className="panel absolute z-20 mt-1 max-h-60 w-full overflow-auto p-1">
                        {customerMatches.map((c, i) => (
                          <li key={c.id}>
                            <button
                              className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                                i === customerHighlight ? "bg-secondary" : "hover:bg-secondary"
                              }`}
                              onMouseEnter={() => setCustomerHighlight(i)}
                              onClick={() => selectCustomer(c)}
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
                        if (p) addProduct(p, toQty(parseQtyPrefix(term).qty));
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setTerm("");
                      }
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tip: type <span className="kbd-hint">3*item</span> to add 3 at once.
                </p>
                {term && results.length ? (
                  <ul className="panel absolute z-20 mt-1 max-h-72 w-full overflow-auto p-1">
                    {results.map((p, i) => (
                      <li key={p.id}>
                        <button
                          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                            i === highlight ? "bg-secondary" : "hover:bg-secondary"
                          }`}
                          onMouseEnter={() => setHighlight(i)}
                          onClick={() => addProduct(p, toQty(parseQtyPrefix(term).qty))}
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

            <CategoryQuickAdd onAdd={addProduct} customerType={customer?.type} />
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="min-w-64 px-4 py-2.5 text-left">Item</th>
                  <th className="w-28 px-2 py-2.5 text-right">Qty / Weight</th>
                  <th className="w-28 px-2 py-2.5 text-right">Rate</th>
                  <th className="w-28 px-2 py-2.5 text-right">Discount</th>
                  <th className="w-24 px-2 py-2.5 text-right">GST</th>
                  <th className="w-28 px-2 py-2.5 text-right">Amount</th>
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
                    const free = freeStock(l.product.id, l.product.stock);
                    const shortfallQty = l.qty - free;
                    const over = shortfallQty > 0;
                    return (
                      <tr key={l.product.id} className="border-t border-border">
                        <td className="px-4 py-2">
                          <div className="font-medium">{l.product.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.product.product_number} · in stock {formatQty(l.product.stock)}{" "}
                            {l.product.unit}
                          </div>
                          {over ? (
                            <div className="mt-0.5 text-xs text-warning">
                              Only {formatQty(Math.max(free, 0))} {l.product.unit} in stock —{" "}
                              {formatQty(shortfallQty)} {l.product.unit} will be added to Credit
                              Invoice
                            </div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              id={`cart-qty-${i}`}
                              className="num h-9 w-24"
                              value={cellValue(`qty-${i}`, String(fromQty(l.qty)))}
                              onChange={(e) =>
                                onCellChange(`qty-${i}`, e.target.value, (v) =>
                                  updateLine(i, { qty: toQty(v || 0) }),
                                )
                              }
                              onKeyDown={(e) => cartCellKeyDown(e, i, "qty")}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => onCellBlur(`qty-${i}`)}
                            />
                            <span className="text-xs text-muted-foreground">{l.product.unit}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              id={`cart-rate-${i}`}
                              className="num h-9 w-24"
                              value={cellValue(`rate-${i}`, String(toRupees(l.price)))}
                              onChange={(e) =>
                                onCellChange(`rate-${i}`, e.target.value, (v) =>
                                  updateLine(i, { price: toPaise(v || 0) }),
                                )
                              }
                              onKeyDown={(e) => cartCellKeyDown(e, i, "rate")}
                              onFocus={(e) => e.target.select()}
                              onBlur={() => onCellBlur(`rate-${i}`)}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Input
                            id={`cart-discount-${i}`}
                            className="num h-9 w-24"
                            value={cellValue(`discount-${i}`, String(toRupees(l.discount)))}
                            onChange={(e) =>
                              onCellChange(`discount-${i}`, e.target.value, (v) =>
                                updateLine(i, { discount: toPaise(v || 0) }),
                              )
                            }
                            onKeyDown={(e) => cartCellKeyDown(e, i, "discount")}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => onCellBlur(`discount-${i}`)}
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
                            onClick={() => {
                              setCart(cart.filter((_, idx) => idx !== i));
                              setCellDrafts({});
                            }}
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

          <div className="panel flex items-center justify-between gap-3 p-4">
            <Label className="text-sm font-medium">Transport Charges (Vandi Vadagai)</Label>
            <div className="flex items-center gap-2">
              <Select value="" onValueChange={(v) => setTransportCharge(v)}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent>
                  {[250, 300, 350, 400, 450, 500].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      {rupees(toPaise(v))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="num h-9 w-28"
                placeholder="0"
                value={transportCharge}
                onChange={(e) => setTransportCharge(e.target.value)}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">Bill summary</h2>
              <div className="flex items-center gap-2">
                <Label htmlFor="gst-toggle" className="text-xs text-muted-foreground">
                  Charge GST
                </Label>
                <Switch id="gst-toggle" checked={gstApplied} onCheckedChange={setGstApplied} />
              </div>
            </div>
            {!gstApplied ? (
              <p className="mt-1 text-xs text-muted-foreground">
                No GST on this bill — the customer pays the price without tax added.
              </p>
            ) : null}
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
              {gstApplied ? (
                interstate ? (
                  <Row label="IGST" value={rupees(calc.totals.igst)} />
                ) : (
                  <>
                    <Row label="CGST" value={rupees(calc.totals.cgst)} />
                    <Row label="SGST" value={rupees(calc.totals.sgst)} />
                  </>
                )
              ) : null}
              {calc.totals.roundOff ? (
                <Row label="Round off" value={rupees(calc.totals.roundOff)} />
              ) : null}
              {toPaise(transportCharge || 0) > 0 ? (
                <Row
                  label="Transport (Vandi Vadagai)"
                  value={rupees(toPaise(transportCharge || 0))}
                />
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
                    onChange={(e) => setPaymentAmount(m, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && remaining === 0 && cart.length) {
                        e.preventDefault();
                        void save(false);
                      }
                    }}
                  />
                  {m === "CREDIT" && toPaise(payments.CREDIT || 0) > 0 && !customer ? (
                    <p className="mt-1 text-xs text-warning">
                      Needs a customer - select one above.
                    </p>
                  ) : null}
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
                <span className="kbd-hint ml-2">Alt+1</span>
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
                <span className="kbd-hint ml-2">Alt+2</span>
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
                <span className="kbd-hint ml-2">Alt+3</span>
              </Button>
            </div>
            <p
              className={
                remaining === 0
                  ? "mt-3 text-sm text-muted-foreground"
                  : `mt-3 rounded-md px-3 py-2 text-sm font-medium ${
                      remaining > 0
                        ? "bg-warning/15 text-warning"
                        : "bg-destructive/10 text-destructive"
                    }`
              }
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
            {blockingIssue ? (
              <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {blockingIssue}
              </p>
            ) : null}
            <div className="mt-4 grid gap-2">
              <Button
                size="lg"
                disabled={busy || !cart.length || !!blockingIssue}
                onClick={() => void save(true)}
              >
                <Printer className="mr-2 h-4 w-4" /> Save &amp; print
                <span className="kbd-hint ml-2">F9</span>
              </Button>
              <Button
                variant="outline"
                disabled={busy || !cart.length || !!blockingIssue}
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

/** Recognisable icons for the common construction-materials categories; anything else gets a plain tag. */
const CATEGORY_ICONS: Record<string, typeof Tag> = {
  cement: Boxes,
  plumbing: Droplets,
  steel: Layers,
  paint: PaintBucket,
  electrical: Zap,
  hardware: Wrench,
  sanitary: ShowerHead,
};
function categoryIcon(name: string) {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? Tag;
}

/**
 * Tap-to-add flow for cashiers in a hurry: pick a category by icon, then
 * tap a product tile (with photo) to add it - no typing required at all.
 * Sits alongside the text search, which stays the fastest path once a
 * cashier knows the product number.
 */
function CategoryQuickAdd({
  onAdd,
  customerType,
}: {
  onAdd: (p: ProductWithStock) => void;
  customerType: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!open) return [];
    try {
      return listCategories();
    } catch {
      return [];
    }
  }, [open]);

  const items = useMemo(() => {
    if (!activeCategory) return [];
    try {
      return listProducts({ category: activeCategory, limit: 60 });
    } catch {
      return [];
    }
  }, [activeCategory]);

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        className="rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Hide category browser" : "Browse by category (tap to add)"}
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              categories.map((c) => {
                const Icon = categoryIcon(c);
                const active = activeCategory === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCategory(active ? null : c)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-4 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-secondary"
                    }`}
                  >
                    <Icon className="h-6 w-6" />
                    {c}
                  </button>
                );
              })
            )}
          </div>

          {activeCategory ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {items.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground">
                  No items in {activeCategory} yet.
                </p>
              ) : (
                items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAdd(p)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-left hover:border-primary hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <ProductImage src={p.image} alt={p.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.product_number}</div>
                      <div className="num text-xs font-medium">
                        {rupees(priceForCustomerType(p, (customerType as never) ?? "Retail"))}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
