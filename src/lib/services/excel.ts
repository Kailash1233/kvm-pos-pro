import * as XLSX from "xlsx";
import { all, one, transaction } from "../db/database";
import { toPaise, toQty, toRupees, fromQty } from "../money";
import { createProduct, ensureLookup, type ProductInput } from "./products";
import { saveExportFile } from "../db/storage";

export const TEMPLATE_COLUMNS = [
  "Product Number",
  "Product Name",
  "Category",
  "Subcategory",
  "Brand",
  "Unit",
  "Purchase Price",
  "Retail Price",
  "Dealer Price",
  "Contractor Price",
  "GST",
  "HSN",
  "Opening Stock",
  "Minimum Stock",
  "Barcode",
] as const;

const VALID_GST = [0, 0.25, 3, 5, 12, 18, 28];

export async function downloadTemplate() {
  const rows = [
    {
      "Product Number": 101,
      "Product Name": "UltraTech PPC Cement 50kg",
      Category: "Cement",
      Subcategory: "PPC",
      Brand: "UltraTech",
      Unit: "Bag",
      "Purchase Price": 355,
      "Retail Price": 380,
      "Dealer Price": 370,
      "Contractor Price": 374,
      GST: 28,
      HSN: "2523",
      "Opening Stock": 250,
      "Minimum Stock": 50,
      Barcode: "",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...TEMPLATE_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Products");
  const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  return saveExportFile("KVM_Product_Import_Template.xlsx", bytes);
}

export interface ParsedRow {
  row: number;
  data: ProductInput & { openingStock: number };
  errors: string[];
  warnings: string[];
}

function num(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : null;
}

/** Reads the sheet and validates every row. Nothing is written yet. */
export function parseProductWorkbook(fileBytes: ArrayBuffer): ParsedRow[] {
  const wb = XLSX.read(fileBytes, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("That file has no sheets in it.");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
    defval: "",
  });
  const existingNumbers = new Set(
    all<{ product_number: string }>("SELECT product_number FROM products").map(
      (r) => r.product_number,
    ),
  );
  const existingBarcodes = new Set(
    all<{ barcode: string }>("SELECT barcode FROM products WHERE barcode IS NOT NULL").map(
      (r) => r.barcode,
    ),
  );
  const seenNumbers = new Set<string>();
  const seenBarcodes = new Set<string>();

  return raw.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rowNo = i + 2;

    const productNumber = String(r["Product Number"] ?? "").trim();
    const name = String(r["Product Name"] ?? "").trim();
    const gst = num(r["GST"]);
    const purchase = num(r["Purchase Price"]);
    const retail = num(r["Retail Price"]);
    const opening = num(r["Opening Stock"]) ?? 0;
    const minStock = num(r["Minimum Stock"]) ?? 0;
    const barcode = String(r["Barcode"] ?? "").trim();
    const hsn = String(r["HSN"] ?? "").trim();

    if (!productNumber) errors.push("Product Number is missing.");
    else if (!/^[A-Za-z0-9\-]+$/.test(productNumber))
      errors.push("Product Number has invalid characters.");
    else if (existingNumbers.has(productNumber))
      errors.push(`Product Number ${productNumber} already exists.`);
    else if (seenNumbers.has(productNumber))
      errors.push(`Product Number ${productNumber} is repeated in this file.`);
    seenNumbers.add(productNumber);

    if (!name) errors.push("Product Name is missing.");
    if (gst === null) errors.push("GST is missing.");
    else if (!VALID_GST.includes(gst)) warnings.push(`GST ${gst}% is unusual.`);
    if (retail === null || retail < 0) errors.push("Retail Price is missing or invalid.");
    if (purchase !== null && purchase < 0) errors.push("Purchase Price cannot be negative.");
    if (opening < 0) errors.push("Opening Stock cannot be negative.");
    if (minStock < 0) errors.push("Minimum Stock cannot be negative.");
    if (barcode) {
      if (existingBarcodes.has(barcode)) errors.push(`Barcode ${barcode} already exists.`);
      else if (seenBarcodes.has(barcode)) errors.push(`Barcode ${barcode} is repeated in this file.`);
      seenBarcodes.add(barcode);
    }
    if (hsn && !/^\d{4,8}$/.test(hsn)) warnings.push("HSN should be 4 to 8 digits.");
    if (retail !== null && purchase !== null && retail < purchase)
      warnings.push("Retail Price is below Purchase Price.");
    if (!String(r["Category"] ?? "").trim()) warnings.push("Category is blank.");
    if (!String(r["Brand"] ?? "").trim()) warnings.push("Brand is blank.");

    return {
      row: rowNo,
      errors,
      warnings,
      data: {
        product_number: productNumber,
        name,
        category: String(r["Category"] ?? "").trim() || null,
        subcategory: String(r["Subcategory"] ?? "").trim() || null,
        brand: String(r["Brand"] ?? "").trim() || null,
        unit: String(r["Unit"] ?? "").trim() || "Piece",
        hsn: hsn || null,
        barcode: barcode || null,
        gst_rate: gst ?? 18,
        purchase_price: toPaise(purchase ?? 0),
        retail_price: toPaise(retail ?? 0),
        dealer_price: toPaise(num(r["Dealer Price"]) ?? 0),
        contractor_price: toPaise(num(r["Contractor Price"]) ?? 0),
        min_stock: toQty(minStock),
        openingStock: toQty(opening),
      },
    };
  });
}

/** All-or-nothing import: one SQLite transaction for the whole file. */
export function importParsedProducts(rows: ParsedRow[], actor: string): number {
  const good = rows.filter((r) => r.errors.length === 0);
  if (!good.length) throw new Error("There are no valid rows to import.");
  return transaction(() => {
    let count = 0;
    for (const r of good) {
      ensureLookup("categories", r.data.category);
      ensureLookup("brands", r.data.brand);
      createProduct(r.data, { openingStock: r.data.openingStock, actor });
      count++;
    }
    return count;
  });
}

// ------------------------------------------------------------------ export

export type SheetData = { name: string; rows: Record<string, unknown>[] };

export async function exportSheets(fileName: string, sheets: SheetData[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ Note: "No records" }]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const bytes = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  return saveExportFile(fileName, bytes);
}

export async function exportCsv(fileName: string, rows: Record<string, unknown>[]) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No records" }]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  return saveExportFile(fileName, new TextEncoder().encode(csv));
}

export function productExportRows() {
  return all<Record<string, unknown>>(
    `SELECT p.product_number AS "Product Number", p.name AS "Product Name",
            p.category AS "Category", p.subcategory AS "Subcategory", p.brand AS "Brand",
            p.unit AS "Unit", p.purchase_price, p.retail_price, p.dealer_price, p.contractor_price,
            p.gst_rate AS "GST", p.hsn AS "HSN", p.min_stock, p.barcode AS "Barcode",
            COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id),0) AS stock,
            CASE p.active WHEN 1 THEN 'Active' ELSE 'Inactive' END AS "Status"
     FROM products p ORDER BY CAST(p.product_number AS INTEGER)`,
  ).map((r) => ({
    "Product Number": r["Product Number"],
    "Product Name": r["Product Name"],
    Category: r["Category"],
    Subcategory: r["Subcategory"],
    Brand: r["Brand"],
    Unit: r["Unit"],
    "Purchase Price": toRupees(Number(r["purchase_price"])),
    "Retail Price": toRupees(Number(r["retail_price"])),
    "Dealer Price": toRupees(Number(r["dealer_price"])),
    "Contractor Price": toRupees(Number(r["contractor_price"])),
    GST: r["GST"],
    HSN: r["HSN"],
    "Current Stock": fromQty(Number(r["stock"])),
    "Minimum Stock": fromQty(Number(r["min_stock"])),
    Barcode: r["Barcode"],
    Status: r["Status"],
  }));
}

export function tableExists(name: string): boolean {
  return !!one("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [name]);
}
