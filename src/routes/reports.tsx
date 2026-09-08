import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell as PieCell,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useApp } from "@/lib/app-context";
import { rupees, formatQty, toRupeeNumber } from "@/lib/money";
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

/**
 * A report cell is either plain text/number, or a tagged Money/Percent
 * value. Money/Percent render with symbols and rounding for on-screen
 * reading, but export as plain numbers - a spreadsheet-formatted currency
 * string (with a ₹ symbol and comma grouping) isn't a real number to Excel,
 * and without a UTF-8 BOM the ₹ symbol itself shows up as mojibake. Keeping
 * the raw value alongside the display string avoids both problems at once.
 */
type MoneyCell = { kind: "money"; paise: number };
type PercentCell = { kind: "percent"; value: number };
type Cell = string | number | MoneyCell | PercentCell;
const Money = (paise: number): MoneyCell => ({ kind: "money", paise });
const Percent = (value: number): PercentCell => ({ kind: "percent", value });

function displayCell(v: Cell): string {
  if (v && typeof v === "object") {
    return v.kind === "money" ? rupees(v.paise) : `${v.value.toFixed(2)}%`;
  }
  return String(v ?? "-");
}
function exportCell(v: Cell): string | number {
  if (v && typeof v === "object") {
    return v.kind === "money" ? toRupeeNumber(v.paise) : Number(v.value.toFixed(2));
  }
  return v;
}
function isNumericCell(v: Cell): boolean {
  return typeof v === "number" || (typeof v === "object" && v !== null);
}

function ExportBtn({ rows, name }: { rows: Record<string, Cell>[]; name: string }) {
  function doExport() {
    const exportRows = rows.map((r) => {
      const out: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(r)) out[k] = exportCell(v);
      return out;
    });
    void exportCsv(`${name}.csv`, exportRows);
  }
  return (
    <Button size="sm" variant="outline" onClick={doExport} disabled={!rows.length}>
      <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export CSV
    </Button>
  );
}

function Table({ rows, name }: { rows: Record<string, Cell>[]; name: string }) {
  const columns = rows.length
    ? Object.keys(rows[0]!).map((key) => ({ key, num: isNumericCell(rows[0]![key]!) }))
    : [];
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
                  {c.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
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
                      {displayCell(r[c.key]!)}
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
  const data = useMemo<Record<string, Cell>[]>(() => {
    try {
      switch (report) {
        case "Daily Sales":
          return dailySales(filter).map((r) => ({
            Day: r.day,
            Bills: r.bills,
            Sales: Money(r.sales),
            Discount: Money(r.discount),
            Tax: Money(r.tax),
          }));
        case "Monthly Sales":
          return monthlySales(filter).map((r) => ({
            Month: r.month,
            Bills: r.bills,
            Sales: Money(r.sales),
            Tax: Money(r.tax),
          }));
        case "Sales by Product":
          return salesByProduct(filter).map((r) => ({
            Product: r.label,
            Qty: formatQty(r.qty),
            Revenue: Money(r.revenue),
            ...(canProfit
              ? {
                  Cost: Money(r.cost),
                  Profit: Money(r.profit),
                  Margin: Percent(r.revenue ? (r.profit / r.revenue) * 100 : 0),
                }
              : {}),
          }));
        case "Sales by Category":
          return salesByCategory(filter).map((r) => ({
            Category: r.label,
            Qty: formatQty(r.qty),
            Revenue: Money(r.revenue),
            ...(canProfit
              ? {
                  Cost: Money(r.cost),
                  Profit: Money(r.profit),
                  Margin: Percent(r.revenue ? (r.profit / r.revenue) * 100 : 0),
                }
              : {}),
          }));
        case "Sales by Brand":
          return salesByBrand(filter).map((r) => ({
            Brand: r.label,
            Qty: formatQty(r.qty),
            Revenue: Money(r.revenue),
            ...(canProfit
              ? {
                  Cost: Money(r.cost),
                  Profit: Money(r.profit),
                  Margin: Percent(r.revenue ? (r.profit / r.revenue) * 100 : 0),
                }
              : {}),
          }));
        case "Sales by User":
          return salesByUser(filter).map((r) => ({
            User: r.label,
            Bills: r.bills,
            Sales: Money(r.sales),
          }));
        case "Purchase Report":
          return listPurchases({ from: filter.from, to: filter.to, limit: 500 }).map((p) => ({
            "Purchase No": p.purchase_number,
            Date: p.purchase_date,
            Supplier: p.supplier_name,
            "Supplier Invoice": p.supplier_invoice ?? "-",
            GST: Money(p.cgst + p.sgst + p.igst),
            Total: Money(p.total),
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
              Total: Money(v.total),
            }));
        }
        case "Stock Report":
          return stockReport(false).map((r) => ({
            Number: r.product_number,
            Item: r.name,
            Category: r.category ?? "-",
            Stock: `${formatQty(r.stock)} ${r.unit}`,
            Minimum: formatQty(r.min_stock),
            Value: Money(r.value),
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
            Outstanding: Money(c.outstanding),
          }));
        case "Supplier Outstanding":
          return listSuppliers({ limit: 500 })
            .filter((s) => s.outstanding > 0)
            .map((s) => ({
              Name: s.name,
              Phone: s.phone ?? "-",
              Outstanding: Money(s.outstanding),
            }));
        case "Payment Collection":
          return paymentCollection(filter).map((r) => ({
            Method: r.method,
            Count: r.count,
            Amount: Money(r.amount),
          }));
        case "Cancelled Bills":
          return cancelledBills(filter).map((r) => ({
            Invoice: r.invoice_number,
            Date: r.sale_date,
            Customer: r.customer_name,
            Amount: Money(r.total),
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
            Amount: Money(r.total),
          }));
        default:
          return [];
      }
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, filter.from, filter.to, canProfit]);

  return (
    <>
      <ReportChart report={report} filter={filter} />
      <Table rows={data} name={report} />
    </>
  );
}

/** Categorical order fixed to the app's theme tokens - never cycled/reassigned by filter. */
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const chartConfig = {
  value: { label: "Amount", color: "var(--chart-1)" },
} satisfies ChartConfig;

/** A small chart above the table for the reports where a trend/comparison is the point. */
function ReportChart({ report, filter }: { report: ReportKey; filter: RangeFilter }) {
  const points = useMemo(() => {
    try {
      switch (report) {
        case "Daily Sales":
          return dailySales(filter)
            .slice()
            .reverse()
            .map((r) => ({ name: r.day.slice(5), value: toRupeeNumber(r.sales) }));
        case "Monthly Sales":
          return monthlySales(filter)
            .slice()
            .reverse()
            .map((r) => ({ name: r.month, value: toRupeeNumber(r.sales) }));
        case "Sales by Product":
          return salesByProduct(filter)
            .slice(0, 8)
            .map((r) => ({ name: r.label.slice(0, 18), value: toRupeeNumber(r.revenue) }));
        case "Sales by Category":
          return salesByCategory(filter)
            .slice(0, 8)
            .map((r) => ({ name: r.label, value: toRupeeNumber(r.revenue) }));
        case "Sales by Brand":
          return salesByBrand(filter)
            .slice(0, 8)
            .map((r) => ({ name: r.label, value: toRupeeNumber(r.revenue) }));
        case "Payment Collection":
          return paymentCollection(filter).map((r) => ({
            name: r.method,
            value: toRupeeNumber(r.amount),
          }));
        default:
          return null;
      }
    } catch {
      return null;
    }
  }, [report, filter.from, filter.to]);

  if (!points || points.length === 0) return null;

  if (report === "Payment Collection") {
    return (
      <div className="panel p-4">
        <ChartContainer config={chartConfig} className="mx-auto max-h-72">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => rupees(Number(v) * 100)} />}
            />
            <Pie
              data={points}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {points.map((_, i) => (
                <PieCell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      </div>
    );
  }

  const isTrend = report === "Daily Sales" || report === "Monthly Sales";

  return (
    <div className="panel p-4">
      <ChartContainer config={chartConfig} className="max-h-72 w-full">
        {isTrend ? (
          <LineChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `₹${v}`} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => rupees(Number(v) * 100)} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--chart-1)" }}
            />
          </LineChart>
        ) : (
          <BarChart data={points} margin={{ left: 4, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={48}
            />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `₹${v}`} />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => rupees(Number(v) * 100)} />}
            />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}
