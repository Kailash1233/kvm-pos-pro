import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileDown } from "lucide-react";
import { PageHeader } from "@/components/kvm/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { rupees, formatQty } from "@/lib/money";
import {
  gstSalesRegister,
  gstPurchaseRegister,
  hsnSummary,
  taxSummary,
  type RangeFilter,
} from "@/lib/services/reports";
import { exportCsv } from "@/lib/services/excel";

export const Route = createFileRoute("/gst")({
  head: () => ({
    meta: [
      { title: "GST — KVM Agencies Sales Register, HSN & Tax Summary" },
      {
        name: "description",
        content:
          "GST sales register, purchase register, HSN summary and CGST/SGST/IGST tax summary for filing.",
      },
    ],
  }),
  component: GstPage,
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function GstPage() {
  const [from, setFrom] = useState(monthStartStr());
  const [to, setTo] = useState(todayStr());
  const filter: RangeFilter = { from, to };

  return (
    <div className="min-h-screen">
      <PageHeader
        title="GST"
        subtitle="Sales register, purchase register, HSN and tax summaries for GST filing"
      />
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales Register</TabsTrigger>
            <TabsTrigger value="purchase">Purchase Register</TabsTrigger>
            <TabsTrigger value="hsn">HSN Summary</TabsTrigger>
            <TabsTrigger value="tax">Tax Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <SalesRegister filter={filter} />
          </TabsContent>
          <TabsContent value="purchase">
            <PurchaseRegister filter={filter} />
          </TabsContent>
          <TabsContent value="hsn">
            <HsnSummary filter={filter} />
          </TabsContent>
          <TabsContent value="tax">
            <TaxSummary filter={filter} />
          </TabsContent>
        </Tabs>
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

function SalesRegister({ filter }: { filter: RangeFilter }) {
  const rows = useMemo(() => {
    try {
      return gstSalesRegister(filter);
    } catch {
      return [];
    }
  }, [filter.from, filter.to]);

  const exportRows = rows.map((r) => ({
    Invoice: r.invoice_number,
    Date: r.sale_date,
    Customer: r.customer_name,
    GSTIN: r.customer_gstin ?? "-",
    Taxable: (r.taxable / 100).toFixed(2),
    CGST: (r.cgst / 100).toFixed(2),
    SGST: (r.sgst / 100).toFixed(2),
    IGST: (r.igst / 100).toFixed(2),
    Total: (r.total / 100).toFixed(2),
  }));

  const totals = rows.reduce(
    (a, r) => ({
      taxable: a.taxable + r.taxable,
      cgst: a.cgst + r.cgst,
      sgst: a.sgst + r.sgst,
      igst: a.igst + r.igst,
      total: a.total + r.total,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 },
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ExportBtn rows={exportRows} name="GST-Sales-Register" />
      </div>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Invoice</th>
              <th className="px-2 py-2.5 text-left">Date</th>
              <th className="px-2 py-2.5 text-left">Customer</th>
              <th className="px-2 py-2.5 text-left">GSTIN</th>
              <th className="px-2 py-2.5 text-right">Taxable</th>
              <th className="px-2 py-2.5 text-right">CGST</th>
              <th className="px-2 py-2.5 text-right">SGST</th>
              <th className="px-2 py-2.5 text-right">IGST</th>
              <th className="px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.invoice_number} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.invoice_number}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.sale_date}</td>
                  <td className="px-2 py-2">{r.customer_name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.customer_gstin ?? "-"}</td>
                  <td className="num px-2 py-2">{rupees(r.taxable)}</td>
                  <td className="num px-2 py-2">{rupees(r.cgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.sgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.igst)}</td>
                  <td className="num px-3 py-2">{rupees(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-3 py-2" colSpan={4}>
                  Total
                </td>
                <td className="num px-2 py-2">{rupees(totals.taxable)}</td>
                <td className="num px-2 py-2">{rupees(totals.cgst)}</td>
                <td className="num px-2 py-2">{rupees(totals.sgst)}</td>
                <td className="num px-2 py-2">{rupees(totals.igst)}</td>
                <td className="num px-3 py-2">{rupees(totals.total)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function PurchaseRegister({ filter }: { filter: RangeFilter }) {
  const rows = useMemo(() => {
    try {
      return gstPurchaseRegister(filter);
    } catch {
      return [];
    }
  }, [filter.from, filter.to]);

  const exportRows = rows.map((r) => ({
    "Purchase No": r.purchase_number,
    "Supplier Invoice": r.supplier_invoice ?? "-",
    Date: r.purchase_date,
    Supplier: r.supplier_name,
    Taxable: (r.taxable / 100).toFixed(2),
    CGST: (r.cgst / 100).toFixed(2),
    SGST: (r.sgst / 100).toFixed(2),
    IGST: (r.igst / 100).toFixed(2),
    Total: (r.total / 100).toFixed(2),
  }));

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ExportBtn rows={exportRows} name="GST-Purchase-Register" />
      </div>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">Purchase No</th>
              <th className="px-2 py-2.5 text-left">Supplier Invoice</th>
              <th className="px-2 py-2.5 text-left">Date</th>
              <th className="px-2 py-2.5 text-left">Supplier</th>
              <th className="px-2 py-2.5 text-right">Taxable</th>
              <th className="px-2 py-2.5 text-right">CGST</th>
              <th className="px-2 py-2.5 text-right">SGST</th>
              <th className="px-2 py-2.5 text-right">IGST</th>
              <th className="px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                  No purchases in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.purchase_number} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.purchase_number}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.supplier_invoice ?? "-"}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.purchase_date}</td>
                  <td className="px-2 py-2">{r.supplier_name}</td>
                  <td className="num px-2 py-2">{rupees(r.taxable)}</td>
                  <td className="num px-2 py-2">{rupees(r.cgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.sgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.igst)}</td>
                  <td className="num px-3 py-2">{rupees(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HsnSummary({ filter }: { filter: RangeFilter }) {
  const rows = useMemo(() => {
    try {
      return hsnSummary(filter);
    } catch {
      return [];
    }
  }, [filter.from, filter.to]);

  const exportRows = rows.map((r) => ({
    HSN: r.hsn,
    Description: r.description,
    "GST %": r.gst_rate,
    Qty: formatQty(r.qty),
    Taxable: (r.taxable / 100).toFixed(2),
    CGST: (r.cgst / 100).toFixed(2),
    SGST: (r.sgst / 100).toFixed(2),
    IGST: (r.igst / 100).toFixed(2),
  }));

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ExportBtn rows={exportRows} name="HSN-Summary" />
      </div>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">HSN</th>
              <th className="px-2 py-2.5 text-left">Description</th>
              <th className="px-2 py-2.5 text-right">GST %</th>
              <th className="px-2 py-2.5 text-right">Qty</th>
              <th className="px-2 py-2.5 text-right">Taxable</th>
              <th className="px-2 py-2.5 text-right">CGST</th>
              <th className="px-2 py-2.5 text-right">SGST</th>
              <th className="px-3 py-2.5 text-right">IGST</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-muted-foreground">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.hsn}</td>
                  <td className="px-2 py-2 text-muted-foreground">{r.description}</td>
                  <td className="num px-2 py-2">{r.gst_rate}%</td>
                  <td className="num px-2 py-2">{formatQty(r.qty)}</td>
                  <td className="num px-2 py-2">{rupees(r.taxable)}</td>
                  <td className="num px-2 py-2">{rupees(r.cgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.sgst)}</td>
                  <td className="num px-3 py-2">{rupees(r.igst)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaxSummary({ filter }: { filter: RangeFilter }) {
  const rows = useMemo(() => {
    try {
      return taxSummary(filter);
    } catch {
      return [];
    }
  }, [filter.from, filter.to]);

  const exportRows = rows.map((r) => ({
    "GST %": r.gst_rate,
    Taxable: (r.taxable / 100).toFixed(2),
    CGST: (r.cgst / 100).toFixed(2),
    SGST: (r.sgst / 100).toFixed(2),
    IGST: (r.igst / 100).toFixed(2),
    Total: (r.total / 100).toFixed(2),
  }));

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <ExportBtn rows={exportRows} name="Tax-Summary" />
      </div>
      <div className="panel overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-right">GST Rate</th>
              <th className="px-2 py-2.5 text-right">Taxable</th>
              <th className="px-2 py-2.5 text-right">CGST</th>
              <th className="px-2 py-2.5 text-right">SGST</th>
              <th className="px-2 py-2.5 text-right">IGST</th>
              <th className="px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">
                  No sales in this range.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.gst_rate} className="border-t border-border">
                  <td className="num px-3 py-2 font-medium">{r.gst_rate}%</td>
                  <td className="num px-2 py-2">{rupees(r.taxable)}</td>
                  <td className="num px-2 py-2">{rupees(r.cgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.sgst)}</td>
                  <td className="num px-2 py-2">{rupees(r.igst)}</td>
                  <td className="num px-3 py-2">{rupees(r.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
