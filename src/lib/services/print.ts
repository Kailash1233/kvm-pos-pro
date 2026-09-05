import { formatQty, rupees, toRupees } from "../money";
import type { BusinessSettings } from "./settings";
import type { Sale, SaleItem, SalePayment } from "./sales";

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const inWords = (paise: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n: number): string =>
    n < 20 ? ones[n]! : `${tens[Math.floor(n / 10)]}${n % 10 ? " " + ones[n % 10] : ""}`;
  const three = (n: number): string =>
    n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? " " + two(n % 100) : ""}` : two(n);
  let n = Math.floor(paise / 100);
  const paisePart = paise % 100;
  if (n === 0 && !paisePart) return "Zero Rupees Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (n) parts.push(three(n));
  let out = parts.join(" ") + " Rupees";
  if (paisePart) out += ` and ${two(paisePart)} Paise`;
  return out + " Only";
};

export interface InvoiceData {
  sale: Sale;
  items: SaleItem[];
  payments: SalePayment[];
  customer?: { name: string; phone?: string | null; address?: string | null; gstin?: string | null } | null;
  outstanding?: number;
}

function taxRows(items: SaleItem[]) {
  const map = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const it of items) {
    const r = map.get(it.gst_rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    r.taxable += it.taxable;
    r.cgst += it.cgst;
    r.sgst += it.sgst;
    r.igst += it.igst;
    map.set(it.gst_rate, r);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function invoiceHtmlA4(d: InvoiceData, s: BusinessSettings, title = "TAX INVOICE"): string {
  const { sale, items, payments } = d;
  const rows = items
    .map(
      (it, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.product_name)}<div class="sub">${esc(it.product_number)}</div></td>
      <td class="c">${esc(it.hsn ?? "")}</td>
      <td class="n">${formatQty(it.qty)} ${esc(it.unit ?? "")}</td>
      <td class="n">${toRupees(it.price).toFixed(2)}</td>
      <td class="n">${it.discount ? toRupees(it.discount).toFixed(2) : "-"}</td>
      <td class="n">${toRupees(it.taxable).toFixed(2)}</td>
      <td class="c">${it.gst_rate}%</td>
      <td class="n">${toRupees(it.cgst + it.sgst + it.igst).toFixed(2)}</td>
      <td class="n">${toRupees(it.total).toFixed(2)}</td>
    </tr>`,
    )
    .join("");

  const tr = taxRows(items)
    .map(
      ([rate, v]) => `<tr>
        <td class="c">${rate}%</td>
        <td class="n">${toRupees(v.taxable).toFixed(2)}</td>
        <td class="n">${toRupees(v.cgst).toFixed(2)}</td>
        <td class="n">${toRupees(v.sgst).toFixed(2)}</td>
        <td class="n">${toRupees(v.igst).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const pay = payments
    .map((p) => `${esc(p.method)} ${rupees(p.amount)}${p.reference ? ` (${esc(p.reference)})` : ""}`)
    .join(" &nbsp;|&nbsp; ");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoice_number)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
  .head { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; }
  .biz { font-size: 20px; font-weight: 700; letter-spacing: .5px; }
  .muted { color: #555; }
  .title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 2px; margin: 10px 0 6px; }
  .grid { display: flex; gap: 10px; }
  .box { border: 1px solid #999; padding: 6px 8px; flex: 1; }
  .box h4 { margin: 0 0 3px; font-size: 10px; text-transform: uppercase; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 4px 5px; }
  th { background: #eee; font-size: 10px; text-transform: uppercase; }
  .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .c { text-align: center; }
  .sub { color: #777; font-size: 9px; }
  .totals { width: 45%; margin-left: auto; margin-top: 8px; }
  .totals td { border: none; padding: 2px 4px; }
  .grand { border-top: 1px solid #111; border-bottom: 2px solid #111; font-weight: 700; font-size: 13px; }
  .foot { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .cancelled { position: fixed; top: 40%; left: 20%; font-size: 90px; color: rgba(200,0,0,.18); transform: rotate(-25deg); }
</style></head><body>
${sale.status === "CANCELLED" ? '<div class="cancelled">CANCELLED</div>' : ""}
<div class="head">
  <div>
    <div class="biz">${esc(s.businessName)}</div>
    <div class="muted">${esc(s.address)}</div>
    <div class="muted">Phone: ${esc(s.phone)}${s.email ? " &nbsp; " + esc(s.email) : ""}</div>
    <div><b>GSTIN:</b> ${esc(s.gstin)} &nbsp; <b>State:</b> ${esc(s.state)} (${esc(s.stateCode)})</div>
  </div>
  <div class="n">
    <div><b>Invoice No:</b> ${esc(sale.invoice_number)}</div>
    <div><b>Date:</b> ${esc(new Date(sale.created_at).toLocaleString("en-IN"))}</div>
    <div><b>Billed by:</b> ${esc(sale.created_by)}</div>
  </div>
</div>
<div class="title">${esc(title)}</div>
<div class="grid">
  <div class="box"><h4>Bill To</h4>
    <div><b>${esc(d.customer?.name ?? "Walk-in Customer")}</b></div>
    <div class="muted">${esc(d.customer?.address ?? "")}</div>
    <div class="muted">${d.customer?.phone ? "Phone: " + esc(d.customer.phone) : ""}</div>
    <div>${d.customer?.gstin ? "<b>GSTIN:</b> " + esc(d.customer.gstin) : ""}</div>
  </div>
  <div class="box"><h4>Supply</h4>
    <div>Place of supply: ${esc(s.state)} (${esc(s.stateCode)})</div>
    <div>Payment: ${pay || "-"}</div>
    <div>Items: ${items.length}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc</th>
    <th>Taxable</th><th>GST</th><th>Tax</th><th>Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="grid" style="margin-top:8px">
  <table style="width:52%">
    <thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
    <tbody>${tr}</tbody>
  </table>
  <table class="totals">
    <tr><td>Taxable Value</td><td class="n">${rupees(sale.taxable)}</td></tr>
    ${sale.discount ? `<tr><td>Discount</td><td class="n">- ${rupees(sale.discount)}</td></tr>` : ""}
    ${sale.cgst ? `<tr><td>CGST</td><td class="n">${rupees(sale.cgst)}</td></tr>` : ""}
    ${sale.sgst ? `<tr><td>SGST</td><td class="n">${rupees(sale.sgst)}</td></tr>` : ""}
    ${sale.igst ? `<tr><td>IGST</td><td class="n">${rupees(sale.igst)}</td></tr>` : ""}
    ${sale.round_off ? `<tr><td>Round Off</td><td class="n">${rupees(sale.round_off)}</td></tr>` : ""}
    <tr class="grand"><td>Grand Total</td><td class="n">${rupees(sale.total)}</td></tr>
    <tr><td>Paid</td><td class="n">${rupees(sale.paid)}</td></tr>
    ${sale.credit_amount ? `<tr><td><b>Balance Due</b></td><td class="n"><b>${rupees(sale.credit_amount)}</b></td></tr>` : ""}
  </table>
</div>
<div style="margin-top:6px"><b>Amount in words:</b> ${esc(inWords(sale.total))}</div>
${d.outstanding ? `<div style="margin-top:4px"><b>Total outstanding for this customer:</b> ${rupees(d.outstanding)}</div>` : ""}
<div class="foot">
  <div style="max-width:60%" class="muted">${esc(s.invoiceFooter)}</div>
  <div class="c">For ${esc(s.businessName)}<div style="height:38px"></div>Authorised Signatory</div>
</div>
</body></html>`;
}

export function invoiceHtmlThermal(d: InvoiceData, s: BusinessSettings): string {
  const { sale, items } = d;
  const rows = items
    .map(
      (it) => `<tr><td colspan="3">${esc(it.product_name)}</td></tr>
      <tr><td>${formatQty(it.qty)} x ${toRupees(it.price).toFixed(2)}</td><td class="c">${it.gst_rate}%</td><td class="n">${toRupees(it.total).toFixed(2)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoice_number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: "Courier New", monospace; font-size: 11px; width: 74mm; color: #000; }
  .c { text-align: center; } .n { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; }
  .big { font-size: 15px; font-weight: bold; }
</style></head><body>
<div class="c big">${esc(s.businessName)}</div>
<div class="c">${esc(s.address)}</div>
<div class="c">Ph: ${esc(s.phone)}</div>
<div class="c">GSTIN: ${esc(s.gstin)}</div>
<hr>
<div>Bill: ${esc(sale.invoice_number)}</div>
<div>${esc(new Date(sale.created_at).toLocaleString("en-IN"))}</div>
<div>Customer: ${esc(d.customer?.name ?? "Walk-in")}</div>
<hr>
<table>${rows}</table>
<hr>
<table>
  <tr><td>Taxable</td><td class="n">${rupees(sale.taxable)}</td></tr>
  <tr><td>GST</td><td class="n">${rupees(sale.cgst + sale.sgst + sale.igst)}</td></tr>
  ${sale.round_off ? `<tr><td>Round Off</td><td class="n">${rupees(sale.round_off)}</td></tr>` : ""}
  <tr class="big"><td>TOTAL</td><td class="n">${rupees(sale.total)}</td></tr>
  <tr><td>Paid</td><td class="n">${rupees(sale.paid)}</td></tr>
  ${sale.credit_amount ? `<tr><td>Balance</td><td class="n">${rupees(sale.credit_amount)}</td></tr>` : ""}
</table>
<hr>
<div class="c">${esc(s.invoiceFooter || "Thank you, visit again!")}</div>
</body></html>`;
}

/** Opens the print dialog using a hidden frame so the app screen is untouched. */
export function printHtml(html: string): void {
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    throw new Error("Printing is not available on this device.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  };
  if (frame.contentWindow?.document.readyState === "complete") run();
  else frame.onload = run;
}

export function printInvoice(d: InvoiceData, s: BusinessSettings): void {
  printHtml(s.printFormat === "THERMAL" ? invoiceHtmlThermal(d, s) : invoiceHtmlA4(d, s));
}

export { inWords };
