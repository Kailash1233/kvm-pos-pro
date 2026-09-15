import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useApp, useQueryData } from "@/lib/app-context";
import { rupees, formatQty } from "@/lib/money";
import { getSale } from "@/lib/services/sales";
import { getCustomer } from "@/lib/services/customers";
import { printInvoice } from "@/lib/services/print";

/** Shows a past bill's items and payments, with reprint. Used from Sales and Home. */
export function BillViewDialog({
  saleId,
  onClose,
}: {
  saleId: number | null;
  onClose: () => void;
}) {
  const { settings } = useApp();
  const viewing = useQueryData(() => (saleId ? getSale(saleId) : null), [saleId]);

  function doPrint() {
    if (!viewing) return;
    const customer = viewing.sale.customer_id ? getCustomer(viewing.sale.customer_id) : null;
    printInvoice(
      {
        sale: viewing.sale,
        items: viewing.items,
        payments: viewing.payments,
        customer,
        outstanding: customer?.outstanding,
      },
      settings,
    );
  }

  return (
    <Dialog open={!!saleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{viewing?.sale.invoice_number}</DialogTitle>
        </DialogHeader>
        {viewing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Customer: </span>
                {viewing.sale.customer_name}
              </div>
              <div>
                <span className="text-muted-foreground">Date: </span>
                {new Date(viewing.sale.created_at).toLocaleString("en-IN")}
              </div>
              <div>
                <span className="text-muted-foreground">Billed by: </span>
                {viewing.sale.created_by}
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                {viewing.sale.status}
                {viewing.sale.gst_applied === 0 ? (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    No GST
                  </span>
                ) : null}
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
            <div className="flex justify-between text-sm">
              <span>
                Paid:{" "}
                {viewing.payments.map((p) => `${p.method} ${rupees(p.amount)}`).join(", ") || "-"}
              </span>
              <span className="font-semibold">Total: {rupees(viewing.sale.total)}</span>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={doPrint} disabled={!viewing}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
