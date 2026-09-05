import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { searchProducts } from "@/lib/services/products";
import { formatQty, rupees } from "@/lib/money";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Products — KVM Agencies Item Master" },
      {
        name: "description",
        content:
          "Search cement, steel, plumbing, paint and electrical items with prices, GST rates and live stock.",
      },
      { property: "og:title", content: "Products — KVM Agencies Item Master" },
      {
        property: "og:description",
        content: "Item master with prices, GST rates and live stock levels.",
      },
    ],
  }),
  component: Products,
});

function Products() {
  const { version } = useApp();
  const [term, setTerm] = useState("");
  const rows = useMemo(() => {
    try {
      return searchProducts(term, { limit: 200, includeInactive: true });
    } catch {
      return [];
    }
  }, [term, version]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Products" subtitle={`${rows.length} items shown`} />
      <div className="p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by number, name, brand or HSN"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>

        <div className="panel mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left">Number</th>
                <th className="px-2 py-2.5 text-left">Item</th>
                <th className="px-2 py-2.5 text-left">Category</th>
                <th className="px-2 py-2.5 text-right">Purchase</th>
                <th className="px-2 py-2.5 text-right">Retail</th>
                <th className="px-2 py-2.5 text-right">GST</th>
                <th className="px-4 py-2.5 text-right">Stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No items match that search.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="num px-4 py-2 text-left">{p.product_number}</td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.brand ?? "-"} · HSN {p.hsn ?? "-"}
                        {p.active ? "" : " · Inactive"}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{p.category ?? "-"}</td>
                    <td className="num px-2 py-2">{rupees(p.purchase_price)}</td>
                    <td className="num px-2 py-2">{rupees(p.retail_price)}</td>
                    <td className="num px-2 py-2">{p.gst_rate}%</td>
                    <td className="num px-4 py-2">
                      <span
                        className={
                          p.stock <= 0
                            ? "text-destructive"
                            : p.stock <= p.min_stock
                              ? "text-warning"
                              : ""
                        }
                      >
                        {formatQty(p.stock)} {p.unit}
                      </span>
                    </td>
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
