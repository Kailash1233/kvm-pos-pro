import { transaction, insert, nowIso, one } from "../db/database";
import { toPaise, toQty } from "../money";
import { createProduct } from "./products";
import { createCustomer } from "./customers";
import { createSupplier } from "./suppliers";
import { savePurchase } from "./purchases";
import { saveBill, saveSalesReturn } from "./sales";
import { receivePayment } from "./customers";
import { setSetting } from "./settings";

interface DemoProduct {
  n: string;
  name: string;
  cat: string;
  brand: string;
  unit: string;
  hsn: string;
  gst: number;
  buy: number;
  sell: number;
  stock: number;
  min: number;
}

const PRODUCTS: DemoProduct[] = [
  { n: "101", name: "UltraTech PPC Cement 50kg", cat: "Cement", brand: "UltraTech", unit: "Bag", hsn: "2523", gst: 28, buy: 355, sell: 380, stock: 320, min: 60 },
  { n: "102", name: "UltraTech OPC 53 Grade 50kg", cat: "Cement", brand: "UltraTech", unit: "Bag", hsn: "2523", gst: 28, buy: 372, sell: 400, stock: 180, min: 50 },
  { n: "103", name: "Dalmia PPC Cement 50kg", cat: "Cement", brand: "Dalmia", unit: "Bag", hsn: "2523", gst: 28, buy: 342, sell: 365, stock: 140, min: 40 },
  { n: "104", name: "Ramco Super Grade 50kg", cat: "Cement", brand: "Ramco", unit: "Bag", hsn: "2523", gst: 28, buy: 360, sell: 385, stock: 30, min: 40 },
  { n: "105", name: "White Cement 5kg", cat: "Cement", brand: "Birla", unit: "Bag", hsn: "2523", gst: 28, buy: 190, sell: 225, stock: 42, min: 10 },
  { n: "201", name: 'PVC Elbow 1 inch', cat: "Plumbing", brand: "Astral", unit: "Piece", hsn: "3917", gst: 18, buy: 32, sell: 45, stock: 420, min: 100 },
  { n: "202", name: 'PVC Tee 1 inch', cat: "Plumbing", brand: "Astral", unit: "Piece", hsn: "3917", gst: 18, buy: 41, sell: 58, stock: 260, min: 80 },
  { n: "203", name: 'CPVC Pipe 1 inch 3m', cat: "Plumbing", brand: "Astral", unit: "Piece", hsn: "3917", gst: 18, buy: 320, sell: 395, stock: 95, min: 30 },
  { n: "204", name: 'PVC Ball Valve 1 inch', cat: "Plumbing", brand: "Supreme", unit: "Piece", hsn: "8481", gst: 18, buy: 118, sell: 165, stock: 60, min: 25 },
  { n: "205", name: "Solvent Cement 100ml", cat: "Plumbing", brand: "Astral", unit: "Piece", hsn: "3506", gst: 18, buy: 78, sell: 110, stock: 18, min: 25 },
  { n: "301", name: "TMT Rod 20mm", cat: "Steel", brand: "Tata Tiscon", unit: "Kg", hsn: "7214", gst: 18, buy: 62, sell: 71, stock: 4200, min: 800 },
  { n: "302", name: "TMT Rod 16mm", cat: "Steel", brand: "Tata Tiscon", unit: "Kg", hsn: "7214", gst: 18, buy: 62, sell: 72, stock: 3600, min: 800 },
  { n: "303", name: "TMT Rod 12mm", cat: "Steel", brand: "JSW", unit: "Kg", hsn: "7214", gst: 18, buy: 61, sell: 70, stock: 2800, min: 800 },
  { n: "304", name: "Binding Wire", cat: "Steel", brand: "Local", unit: "Kg", hsn: "7217", gst: 18, buy: 72, sell: 88, stock: 210, min: 50 },
  { n: "305", name: "MS Angle 40mm", cat: "Steel", brand: "Tata", unit: "Kg", hsn: "7216", gst: 18, buy: 66, sell: 78, stock: 480, min: 100 },
  { n: "401", name: "Asian Paints Apex 10L", cat: "Paint", brand: "Asian Paints", unit: "Bucket", hsn: "3209", gst: 18, buy: 2650, sell: 3150, stock: 24, min: 8 },
  { n: "402", name: "Asian Paints Tractor Emulsion 20L", cat: "Paint", brand: "Asian Paints", unit: "Bucket", hsn: "3209", gst: 18, buy: 3200, sell: 3800, stock: 16, min: 6 },
  { n: "403", name: "Berger Primer 10L", cat: "Paint", brand: "Berger", unit: "Bucket", hsn: "3209", gst: 18, buy: 1450, sell: 1780, stock: 12, min: 6 },
  { n: "404", name: "Wall Putty 40kg", cat: "Paint", brand: "Birla", unit: "Bag", hsn: "3214", gst: 18, buy: 780, sell: 940, stock: 55, min: 20 },
  { n: "501", name: "Finolex Wire 1.5sqmm 90m", cat: "Electrical", brand: "Finolex", unit: "Roll", hsn: "8544", gst: 18, buy: 1580, sell: 1890, stock: 34, min: 10 },
  { n: "502", name: "Finolex Wire 2.5sqmm 90m", cat: "Electrical", brand: "Finolex", unit: "Roll", hsn: "8544", gst: 18, buy: 2480, sell: 2950, stock: 22, min: 10 },
  { n: "503", name: "Anchor Modular Switch 6A", cat: "Electrical", brand: "Anchor", unit: "Piece", hsn: "8536", gst: 18, buy: 42, sell: 65, stock: 380, min: 100 },
  { n: "504", name: "MCB 32A Single Pole", cat: "Electrical", brand: "Havells", unit: "Piece", hsn: "8536", gst: 18, buy: 210, sell: 285, stock: 45, min: 20 },
  { n: "601", name: "Hardware Nails 3 inch", cat: "Hardware", brand: "Local", unit: "Kg", hsn: "7317", gst: 18, buy: 78, sell: 105, stock: 145, min: 40 },
  { n: "602", name: "Door Hinges 4 inch", cat: "Hardware", brand: "Ebco", unit: "Piece", hsn: "8302", gst: 18, buy: 55, sell: 82, stock: 210, min: 60 },
  { n: "603", name: "Cement Trowel", cat: "Hardware", brand: "Taparia", unit: "Piece", hsn: "8201", gst: 18, buy: 165, sell: 235, stock: 38, min: 15 },
  { n: "701", name: "Parryware Wash Basin", cat: "Sanitary", brand: "Parryware", unit: "Piece", hsn: "6910", gst: 18, buy: 2150, sell: 2680, stock: 14, min: 5 },
  { n: "702", name: "Hindware Western Closet", cat: "Sanitary", brand: "Hindware", unit: "Piece", hsn: "6910", gst: 18, buy: 6400, sell: 7850, stock: 8, min: 4 },
  { n: "703", name: "Jaquar Health Faucet", cat: "Sanitary", brand: "Jaquar", unit: "Piece", hsn: "8481", gst: 18, buy: 780, sell: 1050, stock: 26, min: 10 },
  { n: "801", name: "M Sand per unit", cat: "Other", brand: "Local", unit: "Unit", hsn: "2505", gst: 5, buy: 4200, sell: 5200, stock: 12, min: 4 },
];

const CUSTOMERS: {
  name: string;
  phone: string;
  type: "Retail" | "Contractor" | "Dealer";
  limit: number;
  gstin?: string;
}[] = [
  { name: "ABC Constructions", phone: "9840011221", type: "Contractor", limit: 500000, gstin: "33ABCDE1234F1Z5" },
  { name: "Sri Balaji Builders", phone: "9840022332", type: "Contractor", limit: 300000, gstin: "33BBCDE2234F1Z2" },
  { name: "Murugan Hardware", phone: "9840033443", type: "Dealer", limit: 200000, gstin: "33CCCDE3234F1Z9" },
  { name: "Ravi Kumar", phone: "9840044554", type: "Retail", limit: 25000 },
  { name: "Selvam S", phone: "9840055665", type: "Retail", limit: 0 },
  { name: "Chengalpattu Homes LLP", phone: "9840066776", type: "Contractor", limit: 400000, gstin: "33DDCDE4234F1Z7" },
  { name: "Lakshmi Traders", phone: "9840077887", type: "Dealer", limit: 150000, gstin: "29EECDE5234F1Z3" },
  { name: "Anitha R", phone: "9840088998", type: "Retail", limit: 10000 },
  { name: "Karthik M", phone: "9840099009", type: "Retail", limit: 0 },
  { name: "VGN Site Works", phone: "9840010101", type: "Contractor", limit: 250000, gstin: "33FFCDE6234F1Z1" },
];

const SUPPLIERS = [
  { name: "UltraTech Cement Depot", phone: "9500011111", gstin: "33GGCDE7234F1Z8" },
  { name: "Tata Steel Distributor", phone: "9500022222", gstin: "33HHCDE8234F1Z6" },
  { name: "Astral Pipes Agency", phone: "9500033333", gstin: "33IICDE9234F1Z4" },
  { name: "Asian Paints Dealer", phone: "9500044444", gstin: "33JJCDE1034F1Z2" },
  { name: "Chennai Electricals", phone: "9500055555", gstin: "33KKCDE1134F1Z0" },
];

export function isDemoLoaded(): boolean {
  return !!one("SELECT id FROM products WHERE product_number = '101'");
}

/**
 * Loads a realistic demo dataset for training and testing.
 * Kept completely separate from live data entry.
 */
export function loadDemoData(actor: string): void {
  const ts = nowIso();
  const productIds: Record<string, number> = {};

  transaction(() => {
    for (const p of PRODUCTS) {
      if (one("SELECT id FROM products WHERE product_number = ?", [p.n])) continue;
      productIds[p.n] = createProduct(
        {
          product_number: p.n,
          name: p.name,
          category: p.cat,
          brand: p.brand,
          unit: p.unit,
          hsn: p.hsn,
          gst_rate: p.gst,
          purchase_price: toPaise(p.buy),
          retail_price: toPaise(p.sell),
          dealer_price: toPaise(Math.round(p.sell * 0.95)),
          contractor_price: toPaise(Math.round(p.sell * 0.97)),
          min_stock: toQty(p.min),
        },
        { openingStock: toQty(p.stock), actor },
      );
    }
    for (const c of CUSTOMERS) {
      createCustomer(
        {
          name: c.name,
          phone: c.phone,
          type: c.type,
          credit_limit: toPaise(c.limit),
          gstin: c.gstin ?? null,
          address: "Chengalpattu",
          opening_balance: 0,
        },
        actor,
      );
    }
    for (const s of SUPPLIERS) {
      createSupplier({ name: s.name, phone: s.phone, gstin: s.gstin, address: "Chennai" }, actor);
    }
    insert("INSERT OR IGNORE INTO units(name) VALUES('Bag')", []);
  });

  const pid = (n: string) =>
    productIds[n] ??
    (one<{ id: number }>("SELECT id FROM products WHERE product_number = ?", [n])?.id as number);
  const custId = (name: string) =>
    one<{ id: number }>("SELECT id FROM customers WHERE name = ?", [name])?.id ?? null;
  const suppId = (name: string) =>
    one<{ id: number }>("SELECT id FROM suppliers WHERE name = ?", [name])?.id as number;

  // Sample purchases (stock in + supplier ledger)
  savePurchase({
    supplierId: suppId("UltraTech Cement Depot"),
    supplierInvoice: "UT/2026/1188",
    date: ts.slice(0, 10),
    lines: [
      { productId: pid("101"), qty: toQty(200), price: toPaise(355), discount: 0 },
      { productId: pid("102"), qty: toQty(100), price: toPaise(372), discount: 0 },
    ],
    amountPaid: toPaise(50000),
    user: actor,
  });
  savePurchase({
    supplierId: suppId("Astral Pipes Agency"),
    supplierInvoice: "AST/5521",
    date: ts.slice(0, 10),
    lines: [
      { productId: pid("201"), qty: toQty(300), price: toPaise(32), discount: 0 },
      { productId: pid("203"), qty: toQty(60), price: toPaise(320), discount: 0 },
    ],
    amountPaid: 0,
    user: actor,
  });

  // Sample sales
  saveBill({
    customerId: custId("ABC Constructions"),
    billDiscount: 0,
    lines: [
      { productId: pid("101"), qty: toQty(50), price: toPaise(374), discount: 0 },
      { productId: pid("301"), qty: toQty(500), price: toPaise(71), discount: 0 },
    ],
    payments: [],
    payFull: "CREDIT",
    user: actor,
  });

  saveBill({
    customerId: custId("Ravi Kumar"),
    billDiscount: 0,
    lines: [
      { productId: pid("201"), qty: toQty(20), price: toPaise(45), discount: 0 },
      { productId: pid("205"), qty: toQty(2), price: toPaise(110), discount: 0 },
    ],
    payments: [],
    payFull: "CASH",
    user: actor,
  });

  const walkIn = saveBill({
    customerId: null,
    billDiscount: 0,
    lines: [{ productId: pid("404"), qty: toQty(4), price: toPaise(940), discount: 0 }],
    payments: [],
    payFull: "UPI",
    user: actor,
  });

  // Sample sales return against the walk-in bill
  const walkInItems = one<{ id: number; qty: number }>(
    "SELECT id, qty FROM sale_items WHERE sale_id = ? LIMIT 1",
    [walkIn.saleId],
  );
  if (walkInItems) {
    saveSalesReturn({
      saleId: walkIn.saleId,
      reason: "Damaged packing",
      lines: [{ saleItemId: walkInItems.id, qty: toQty(1) }],
      user: actor,
    });
  }

  receivePayment({
    customerId: custId("ABC Constructions") as number,
    amount: toPaise(50000),
    method: "UPI",
    reference: "UPI4455",
    user: actor,
  });

  setSetting("demoDataLoaded", true);
}
