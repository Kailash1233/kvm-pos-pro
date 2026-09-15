import { useRef, useState } from "react";
import { Download, Upload, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/app-context";
import {
  downloadTemplate,
  parseProductWorkbook,
  importParsedProducts,
  type ParsedRow,
  type ImportResult,
} from "@/lib/services/excel";

/**
 * Bulk-adds products from a CSV/XLSX sheet: parse -> preview every row's
 * errors/warnings -> import only the valid rows in one transaction.
 * Existing product numbers are rejected, not overwritten, so a re-run of
 * the same file (or a price-list export) never silently changes prices.
 */
export function ImportProductsDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { user } = useApp();
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const good = rows?.filter((r) => r.errors.length === 0) ?? [];
  const bad = rows?.filter((r) => r.errors.length > 0) ?? [];

  function reset() {
    setRows(null);
    setFileName("");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function close() {
    reset();
    onClose();
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      const parsed = parseProductWorkbook(isCsv ? await file.text() : await file.arrayBuffer());
      if (!parsed.length) {
        toast.error("That file doesn't have any rows in it.");
        setRows(null);
        return;
      }
      setRows(parsed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That file could not be read.");
      setRows(null);
    }
  }

  async function doImport() {
    if (!user || !good.length) return;
    setBusy(true);
    try {
      const r = await importParsedProducts(good, user.full_name);
      setResult(r);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The import could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Add many products at once from a spreadsheet, instead of one at a time.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <span>
                <b>{result.created}</b> product{result.created === 1 ? "" : "s"} added.
              </span>
            </div>
            {result.imagesFetched > 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <b>{result.imagesFetched}</b> product photo{result.imagesFetched === 1 ? "" : "s"}{" "}
                  downloaded from the Image URL column.
                </span>
              </div>
            ) : null}
            {result.imagesFailed.length > 0 ? (
              <div className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {result.imagesFailed.length} image{result.imagesFailed.length === 1 ? "" : "s"}{" "}
                  could not be downloaded (row {result.imagesFailed.map((f) => f.row).join(", ")}).
                </div>
                <p className="mt-1 text-muted-foreground">
                  This usually means the site hosting that image blocks downloads from other apps.
                  The products were still added — open each one and add its photo manually.
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : rows ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">{fileName}</span>
              <span className="flex items-center gap-1 text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> {good.length} ready to import
              </span>
              {bad.length ? (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {bad.length} will be skipped
                </span>
              ) : null}
            </div>
            <div className="panel max-h-80 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-secondary text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Row</th>
                    <th className="px-3 py-2 text-left">Product</th>
                    <th className="px-3 py-2 text-left">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.row} className="border-t border-border">
                      <td className="px-3 py-1.5 text-muted-foreground">{r.row}</td>
                      <td className="px-3 py-1.5">
                        {r.data.product_number} {r.data.name ? `· ${r.data.name}` : ""}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.errors.length ? (
                          <span className="text-destructive">{r.errors.join(" ")}</span>
                        ) : r.warnings.length ? (
                          <span className="text-warning">{r.warnings.join(" ")}</span>
                        ) : (
                          <span className="text-muted-foreground">Looks good</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Choose a different file
              </Button>
              <Button onClick={() => void doImport()} disabled={busy || !good.length}>
                {busy
                  ? "Importing…"
                  : `Import ${good.length} product${good.length === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-secondary p-4 text-sm">
              <p>
                Start from the sample sheet so the columns match exactly. Fill in one row per
                product, then upload it below.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-muted-foreground">
                <li>
                  Product Number and Product Name are required, and must be new (not already used).
                </li>
                <li>Prices are plain rupee numbers, e.g. 380, not ₹380.00.</li>
                <li>
                  Image URL is optional — a direct link to a photo online. Most sites block this, so
                  treat it as a bonus, not the main way to add photos; adding a photo by hand on the
                  product screen always works.
                </li>
              </ul>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void downloadTemplate().catch(() => toast.error("Could not create the template."))
              }
            >
              <Download className="mr-1.5 h-4 w-4" /> Download sample template (.xlsx)
            </Button>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> Choose CSV or Excel file
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
