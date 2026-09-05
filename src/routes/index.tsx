import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  IndianRupee,
  Package,
  ReceiptText,
  Users,
} from "lucide-react";
import { useApp, useQueryData } from "@/lib/app-context";
import { daySummary, stockValue } from "@/lib/services/reports";
import { lowStockProducts } from "@/lib/services/products";
import { listSales } from "@/lib/services/sales";
import { rupees, formatQty, rupeesShort } from "@/lib/money";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today at KVM Agencies — Sales, Stock & Dues" },
      {
        name: "description",
        content:
          "Daily sales total, payment split, low stock warnings and pending customer dues for KVM Agencies.",
      },
      { property: "og:title", content: "Today at KVM Agencies — Sales, Stock & Dues" },
      {
        property: "og:description",
        content: "Daily sales, payment split, low stock warnings and pending dues.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useApp();
  const summary = useQueryData(() => daySummary());
  const stock = useQueryData(() => stockValue());
  const low = useQueryData(() => lowStockProducts(8));
  const recent = useQueryData(() => listSales({ limit: 8 }));

  return (
    <div className="min-h-screen">
      <PageHeader
        title={`Welcome, ${user?.full_name ?? ""}`}
        subtitle={new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        actions={
          <Button asChild size="lg">
            <Link to="/billing">
              New bill <span className="kbd-hint ml-2">F2</span>
            </Link>
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Stat
            icon={IndianRupee}
            label="Today's sales"
            value={rupees(summary?.sales ?? 0)}
            hint={`${summary?.bills ?? 0} bills · ${formatQty(summary?.itemsSold ?? 0)} items`}
          />
          <Stat
            icon={ReceiptText}
            label="Cash collected today"
            value={rupees(summary?.cash ?? 0)}
            hint={`UPI ${rupeesShort(summary?.upi ?? 0)} · Card ${rupeesShort(summary?.card ?? 0)}`}
          />
          <Stat
            icon={Users}
            label="Customer dues"
            value={rupees(summary?.customerOutstanding ?? 0)}
            hint={`On credit today ${rupeesShort(summary?.credit ?? 0)}`}
          />
          <Stat
            icon={Package}
            label="Stock value (cost)"
            value={rupees(stock?.cost ?? 0)}
            hint={`Selling value ${rupeesShort(stock?.retail ?? 0)}`}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-medium">Recent bills</h2>
              <Link
                to="/billing"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Billing <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {recent && recent.length ? (
              <table className="w-full text-sm">
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2.5 font-medium">{s.invoice_number}</td>
                      <td className="px-2 py-2.5 text-muted-foreground">{s.customer_name}</td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="num px-5 py-2.5">
                        {s.status === "CANCELLED" ? (
                          <span className="text-destructive">Cancelled</span>
                        ) : (
                          rupees(s.total)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text="No bills yet. Press F2 to make the first one." />
            )}
          </section>

          <section className="panel">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-warning" /> Items running low
              </h2>
              <Link
                to="/stock"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Stock <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {low && low.length ? (
              <table className="w-full text-sm">
                <tbody>
                  {low.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-2.5">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.product_number} · {p.brand ?? "-"}
                        </div>
                      </td>
                      <td className="num px-5 py-2.5">
                        <span className={p.stock <= 0 ? "text-destructive" : "text-warning"}>
                          {formatQty(p.stock)} {p.unit}
                        </span>
                        <div className="text-xs text-muted-foreground">
                          min {formatQty(p.min_stock)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty text="Every item is above its minimum level." />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="num mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-5 py-10 text-center text-sm text-muted-foreground">{text}</p>;
}
