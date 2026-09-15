import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Search, Plus, ImagePlus, X, ChevronDown, ChevronUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/kvm/PageHeader";
import { ProductImage } from "@/components/kvm/ProductImage";
import { ImportProductsDialog } from "@/components/kvm/ImportProductsDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/lib/app-context";
import {
  searchProducts,
  createProduct,
  updateProduct,
  nextProductNumber,
  listCategories,
  listBrands,
  listUnits,
  type ProductWithStock,
  type ProductInput,
} from "@/lib/services/products";
import { formatQty, rupees, toPaise, toQty, toRupees, fromQty } from "@/lib/money";
import { readImageAsDataUrl } from "@/lib/image";

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

const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];

function Products() {
  const { version, refresh, allowed } = useApp();
  const [term, setTerm] = useState("");
  const [editing, setEditing] = useState<ProductWithStock | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const rows = useMemo(() => {
    try {
      return searchProducts(term, { limit: 200, includeInactive: true });
    } catch {
      return [];
    }
  }, [term, version]);

  const canEdit = allowed("product.edit") || allowed("product.create");

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Products"
        subtitle={`${rows.length} items shown`}
        actions={
          allowed("product.create") ? (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Import
              </Button>
              <Button onClick={() => setEditing("new")}>
                <Plus className="mr-1.5 h-4 w-4" /> Add Product
              </Button>
            </>
          ) : undefined
        }
      />
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
                <th className="px-4 py-2.5 text-left"></th>
                <th className="px-2 py-2.5 text-left">Number</th>
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
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    No items match that search.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-t border-border ${canEdit ? "cursor-pointer hover:bg-secondary/60" : ""}`}
                    onClick={() => canEdit && setEditing(p)}
                  >
                    <td className="px-4 py-2">
                      <ProductImage src={p.image} alt={p.name} size="sm" />
                    </td>
                    <td className="num px-2 py-2 text-left">{p.product_number}</td>
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

      <ProductFormDialog
        value={editing}
        onClose={() => setEditing(null)}
        onDone={() => {
          refresh();
          setEditing(null);
        }}
      />
      <ImportProductsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
      />
    </div>
  );
}

const EMPTY_FORM = {
  product_number: "",
  name: "",
  category: "",
  subcategory: "",
  brand: "",
  unit: "Piece",
  hsn: "",
  barcode: "",
  gst_rate: 18,
  purchase_price: "",
  retail_price: "",
  dealer_price: "",
  contractor_price: "",
  min_stock: "",
  opening_stock: "",
  image: null as string | null,
};

function ProductFormDialog({
  value,
  onClose,
  onDone,
}: {
  value: ProductWithStock | "new" | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useMemo(() => {
    if (value === "new") {
      setForm({ ...EMPTY_FORM, unit: listUnits()[0] ?? "Piece" });
      setAdvanced(false);
    } else if (value) {
      setForm({
        product_number: value.product_number,
        name: value.name,
        category: value.category ?? "",
        subcategory: value.subcategory ?? "",
        brand: value.brand ?? "",
        unit: value.unit,
        hsn: value.hsn ?? "",
        barcode: value.barcode ?? "",
        gst_rate: value.gst_rate,
        purchase_price: String(toRupees(value.purchase_price)),
        retail_price: String(toRupees(value.retail_price)),
        dealer_price: value.dealer_price ? String(toRupees(value.dealer_price)) : "",
        contractor_price: value.contractor_price ? String(toRupees(value.contractor_price)) : "",
        min_stock: value.min_stock ? String(fromQty(value.min_stock)) : "",
        opening_stock: "",
        image: value.image,
      });
      setAdvanced(false);
    }
  }, [value]);

  if (!value) return null;
  const isNew = value === "new";

  async function pickImage(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setForm((f) => ({ ...f, image: dataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That image could not be used.");
    }
  }

  async function submit() {
    if (!user) return;
    if (!form.product_number.trim()) {
      toast.error("Please enter a product number.");
      return;
    }
    if (!form.name.trim()) {
      toast.error("Please enter a product name.");
      return;
    }
    if (!form.retail_price || Number(form.retail_price) < 0) {
      toast.error("Please enter a selling price.");
      return;
    }
    const input: ProductInput = {
      product_number: form.product_number,
      name: form.name,
      category: form.category || null,
      subcategory: form.subcategory || null,
      brand: form.brand || null,
      unit: form.unit,
      hsn: form.hsn || null,
      barcode: form.barcode || null,
      gst_rate: form.gst_rate,
      purchase_price: toPaise(form.purchase_price || 0),
      retail_price: toPaise(form.retail_price || 0),
      dealer_price: toPaise(form.dealer_price || 0),
      contractor_price: toPaise(form.contractor_price || 0),
      min_stock: toQty(form.min_stock || 0),
      image: form.image,
    };
    setBusy(true);
    try {
      if (isNew) {
        createProduct(input, {
          openingStock: toQty(form.opening_stock || 0),
          actor: user.full_name,
        });
        toast.success("Product added.");
      } else if (value) {
        updateProduct(value.id, input, user.full_name);
        toast.success("Product updated.");
      }
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Product" : "Edit Product"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[96px_1fr]">
          <div className="flex flex-col items-center gap-2">
            <ProductImage src={form.image} alt={form.name || "Product"} size="lg" />
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                title="Add photo"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
              {form.image ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, image: null }))}
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickImage(e.target.files?.[0])}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Product Number
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  className="num"
                  value={form.product_number}
                  onChange={(e) => setForm({ ...form, product_number: e.target.value })}
                />
                {isNew ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setForm((f) => ({ ...f, product_number: nextProductNumber(f.category) }))
                    }
                  >
                    Suggest
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listUnits().map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Product Name
              </Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </Label>
              <Input
                className="mt-1.5"
                list="kvm-categories"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <datalist id="kvm-categories">
                {listCategories().map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Brand</Label>
              <Input
                className="mt-1.5"
                list="kvm-brands"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
              <datalist id="kvm-brands">
                {listBrands().map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Purchase Price
              </Label>
              <Input
                className="num mt-1.5"
                value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Selling Price
              </Label>
              <Input
                className="num mt-1.5"
                value={form.retail_price}
                onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">GST</Label>
              <Select
                value={String(form.gst_rate)}
                onValueChange={(v) => setForm({ ...form, gst_rate: Number(v) })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Minimum Stock
              </Label>
              <Input
                className="num mt-1.5"
                value={form.min_stock}
                onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
              />
            </div>
            {isNew ? (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Opening Stock
                </Label>
                <Input
                  className="num mt-1.5"
                  value={form.opening_stock}
                  onChange={(e) => setForm({ ...form, opening_stock: e.target.value })}
                />
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          className="flex items-center gap-1 text-sm text-primary"
          onClick={() => setAdvanced(!advanced)}
        >
          {advanced ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          Advanced details
        </button>

        {advanced ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Barcode
              </Label>
              <Input
                className="mt-1.5"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">HSN</Label>
              <Input
                className="mt-1.5"
                value={form.hsn}
                onChange={(e) => setForm({ ...form, hsn: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Dealer Price
              </Label>
              <Input
                className="num mt-1.5"
                value={form.dealer_price}
                onChange={(e) => setForm({ ...form, dealer_price: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Contractor Price
              </Label>
              <Input
                className="num mt-1.5"
                value={form.contractor_price}
                onChange={(e) => setForm({ ...form, contractor_price: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Subcategory
              </Label>
              <Input
                className="mt-1.5"
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {isNew ? "Add product" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
