import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/app-context";
import { stockReport, stockValue } from "@/lib/services/reports";
import { formatQty, rupees } from "@/lib/money";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "Stock — KVM Agencies Inventory Levels" },
      {
        name: "description",
        content:
          "Live stock quantities, low stock warnings and total inventory value for the building materials shop.",
      },
      { property: "og:title", content: "Stock — KVM Agencies Inventory Levels" },
      {
        property: "og:description",
        content: "Live stock levels, low stock warnings and inventory value.",
      },
    ],
  }),
  component: Stock,
});

function Stock() {
  const { version } = useApp();
  const [lowOnly, setLowOnly] = useState(false);
  const rows = useMemo(() => {
    try {
      return stockReport(lowOnly);
    } catch {
      return [];
    }
  }, [lowOnly, version]);
  const value = useMemo(() => {
    try {
      return stockValue();
    } catch {
      return { cost: 0, retail: 0, items: 0 };
    }
  }, [version]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Stock"
        subtitle={`Cost value ${rupees(value.cost)} · Selling value ${rupees(value.retail)}`}
        actions={
          <Button variant={lowOnly ? "default" : "outline"} onClick={() => setLowOnly(!lowOnly)}>
            {lowOnly ? "Showing low stock" : "Show low stock only"}
          </Button>
        }
      />
      <div className="p-6">
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Number</th>
                <th className="px-2 py-2.5 text-left">Item</th>
                <th className="px-2 py-2.5 text-right">In stock</th>
                <th className="px-2 py-2.5 text-right">Minimum</th>
                <th className="px-4 py-2.5 text-right">Cost value</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                    {lowOnly ? "Nothing is below its minimum level." : "No items yet."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.product_number} className="border-t border-border">
                    <td className="num px-4 py-2 text-left">{r.product_number}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.category ?? "-"} · {r.brand ?? "-"}
                      </div>
                    </td>
                    <td className="num px-2 py-2">
                      <span
                        className={
                          r.stock <= 0
                            ? "text-destructive"
                            : r.stock <= r.min_stock
                              ? "text-warning"
                              : ""
                        }
                      >
                        {formatQty(r.stock)} {r.unit}
                      </span>
                    </td>
                    <td className="num px-2 py-2 text-muted-foreground">
                      {formatQty(r.min_stock)}
                    </td>
                    <td className="num px-4 py-2">{rupees(r.value)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
