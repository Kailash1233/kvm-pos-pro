import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/lib/app-context";
import { rupees, formatQty, pct } from "@/lib/money";
import {
  dailySales,
  monthlySales,
  salesByProduct,
  salesByCategory,
  salesByBrand,
  salesByUser,
  paymentCollection,
  cancelledBills,
  stockReport,
  type RangeFilter,
} from "@/lib/services/reports";
import { listPurchases } from "@/lib/services/purchases";
import { movements } from "@/lib/services/inventory";
import { listCustomers } from "@/lib/services/customers";
import { listSuppliers } from "@/lib/services/suppliers";
import { listReturns } from "@/lib/services/sales";
import { exportCsv } from "@/lib/services/excel";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — KVM Agencies Sales, Stock & Profit" },
      {
        name: "description",
        content:
          "Daily and monthly sales, product/category/brand performance, purchases, stock and profit reports.",
      },
    ],
  }),
  component: ReportsPage,
});

const REPORTS = [
  "Daily Sales",
  "Monthly Sales",
  "Sales by Product",
  "Sales by Category",
  "Sales by Brand",
  "Sales by User",
  "Purchase Report",
  "Purchase by Supplier",
  "Stock Report",
  "Stock Movement",
  "Low Stock",
  "Customer Outstanding",
  "Supplier Outstanding",
  "Payment Collection",
  "Cancelled Bills",
  "Sales Returns",
] as const;
type ReportKey = (typeof REPORTS)[number];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function ReportsPage() {
  const { allowed } = useApp();
  const [active, setActive] = useState<ReportKey>("Daily Sales");
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const canProfit = allowed("profit.view");

  const filter: RangeFilter = { from, to };

  return (
    <div className="min-h-screen">
      <PageHeader title="Reports" subtitle="Filter by date range and export any report" />
      <div className="grid gap-6 p-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {REPORTS.map((r) => (
            <button
              key={r}
              onClick={() => setActive(r)}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
                active === r ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
              }`}
            >
              {r}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
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
          </div>
          <ReportBody report={active} filter={filter} canProfit={canProfit} />
        </div>
      </div>
    </div>
  );
}

function ExportBtn({ rows, name }: { rows: Record<string, unknown>[]; name: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void exportCsv(`${name}.csv`, rows)}
      disabled={!rows.length}
    >
      <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export CSV
    </Button>
  );
}

function Table({
  columns,
  rows,
  name,
}: {
  columns: { key: string; label: string; num?: boolean }[];
  rows: Record<string, unknown>[];
  name: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ExportBtn rows={rows} name={name} />
      </div>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 ${c.num ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-14 text-center text-muted-foreground"
                >
                  No data for this range.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 ${c.num ? "num" : ""}`}>
                      {String(r[c.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportBody({
  report,
  filter,
  canProfit,
}: {
  report: ReportKey;
  filter: RangeFilter;
  canProfit: boolean;
}) {
  const data = useMemo(() => {
    try {
      switch (report) {
        case "Daily Sales":
          return dailySales(filter).map((r) => ({
            Day: r.day,
            Bills: r.bills,
            Sales: rupees(r.sales),
            Discount: rupees(r.discount),
            Tax: rupees(r.tax),
          }));
        case "Monthly Sales":
          return monthlySales(filter).map((r) => ({
            Month: r.month,
            Bills: r.bills,
            Sales: rupees(r.sales),
            Tax: rupees(r.tax),
          }));
        case "Sales by Product":
          return salesByProduct(filter).map((r) => ({
            Product: r.label,
            Qty: formatQty(r.qty),
            Revenue: rupees(r.revenue),
            ...(canProfit
              ? { Cost: rupees(r.cost), Profit: rupees(r.profit), Margin: pct(r.profit, r.revenue) }
              : {}),
          }));
        case "Sales by Category":
          return salesByCategory(filter).map((r) => ({
            Category: r.label,
            Qty: formatQty(r.qty),
            Revenue: rupees(r.revenue),
            ...(canProfit
              ? { Cost: rupees(r.cost), Profit: rupees(r.profit), Margin: pct(r.profit, r.revenue) }
              : {}),
          }));
        case "Sales by Brand":
          return salesByBrand(filter).map((r) => ({
            Brand: r.label,
            Qty: formatQty(r.qty),
            Revenue: rupees(r.revenue),
            ...(canProfit
              ? { Cost: rupees(r.cost), Profit: rupees(r.profit), Margin: pct(r.profit, r.revenue) }
              : {}),
          }));
        case "Sales by User":
          return salesByUser(filter).map((r) => ({
            User: r.label,
            Bills: r.bills,
            Sales: rupees(r.sales),
          }));
        case "Purchase Report":
          return listPurchases({ from: filter.from, to: filter.to, limit: 500 }).map((p) => ({
            "Purchase No": p.purchase_number,
            Date: p.purchase_date,
            Supplier: p.supplier_name,
            "Supplier Invoice": p.supplier_invoice ?? "-",
            GST: rupees(p.cgst + p.sgst + p.igst),
            Total: rupees(p.total),
          }));
        case "Purchase by Supplier": {
          const rows = listPurchases({ from: filter.from, to: filter.to, limit: 2000 });
          const map = new Map<string, { count: number; total: number }>();
          for (const p of rows) {
            const e = map.get(p.supplier_name) ?? { count: 0, total: 0 };
            e.count++;
            e.total += p.total;
            map.set(p.supplier_name, e);
          }
          return [...map.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([supplier, v]) => ({
              Supplier: supplier,
              Purchases: v.count,
              Total: rupees(v.total),
            }));
        }
        case "Stock Report":
          return stockReport(false).map((r) => ({
            Number: r.product_number,
            Item: r.name,
            Category: r.category ?? "-",
            Stock: `${formatQty(r.stock)} ${r.unit}`,
            Minimum: formatQty(r.min_stock),
            Value: rupees(r.value),
          }));
        case "Stock Movement":
          return movements({ from: filter.from, to: filter.to, limit: 500 }).map((m) => ({
            Date: new Date(m.created_at).toLocaleString("en-IN"),
            Product: `${m.product_number} - ${m.product_name}`,
            Type: m.type,
            Qty: formatQty(m.qty),
            Reference: m.ref_label ?? "-",
            By: m.created_by,
          }));
        case "Low Stock":
          return stockReport(true).map((r) => ({
            Number: r.product_number,
            Item: r.name,
            Stock: `${formatQty(r.stock)} ${r.unit}`,
            Minimum: formatQty(r.min_stock),
          }));
        case "Customer Outstanding":
          return listCustomers({ outstandingOnly: true, limit: 500 }).map((c) => ({
            Name: c.name,
            Phone: c.phone ?? "-",
            Type: c.type,
            Outstanding: rupees(c.outstanding),
          }));
        case "Supplier Outstanding":
          return listSuppliers({ limit: 500 })
            .filter((s) => s.outstanding > 0)
            .map((s) => ({
              Name: s.name,
              Phone: s.phone ?? "-",
              Outstanding: rupees(s.outstanding),
            }));
        case "Payment Collection":
          return paymentCollection(filter).map((r) => ({
            Method: r.method,
            Count: r.count,
            Amount: rupees(r.amount),
          }));
        case "Cancelled Bills":
          return cancelledBills(filter).map((r) => ({
            Invoice: r.invoice_number,
            Date: r.sale_date,
            Customer: r.customer_name,
            Amount: rupees(r.total),
            Reason: r.cancel_reason ?? "-",
            "Cancelled By": r.cancelled_by ?? "-",
          }));
        case "Sales Returns":
          return listReturns(300).map((r) => ({
            "Return No": r.return_number,
            Date: r.return_date,
            Invoice: r.invoice_number,
            Customer: r.customer_name,
            Reason: r.reason ?? "-",
            Amount: rupees(r.total),
          }));
        default:
          return [];
      }
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, filter.from, filter.to, canProfit]);

  const columns = data.length
    ? Object.keys(data[0]!).map((k) => ({
        key: k,
        label: k,
        num:
          /^(Qty|Bills|Count|Purchases)$/.test(k) ||
          /^(Sales|Revenue|Cost|Profit|Margin|Tax|Discount|Total|Amount|Value|Outstanding|GST|Minimum|Stock)/.test(
            k,
          ),
      }))
    : [];

  return <Table columns={columns} rows={data as Record<string, unknown>[]} name={report} />;
}
