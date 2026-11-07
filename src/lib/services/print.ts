import { formatQty, rupees, toRupees } from "../money";
import type { BusinessSettings } from "./settings";
import type { Sale, SaleItem, SalePayment } from "./sales";

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

const inWords = (paise: number): string => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
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
  customer?: {
    name: string;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
  } | null;
  outstanding?: number;
  /** Still owed from this exact bill right now - dropped off once fully delivered. */
  pendingDeliveries?: { product_name: string; unit: string | null; pending_qty: number }[];
}

function pendingDeliveryHtml(d: InvoiceData): string {
  if (!d.pendingDeliveries?.length) return "";
  const rows = d.pendingDeliveries
    .map(
      (p) =>
        `<li>${esc(p.product_name)} — ${formatQty(p.pending_qty)} ${esc(p.unit ?? "")} to be delivered</li>`,
    )
    .join("");
  return `<div class="box" style="margin-top:8px; border-color:#c77;"><h4>Pending Delivery</h4>
    <ul style="margin:0; padding-left:18px;">${rows}</ul>
  </div>`;
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
  const gstOn = sale.gst_applied !== 0;
  const rows = items
    .map(
      (it, i) => `<tr>
      <td class="c">${i + 1}</td>
      <td>${esc(it.product_name)}</td>
      ${gstOn ? `<td class="c">${esc(it.hsn ?? "")}</td>` : ""}
      <td class="n">${formatQty(it.qty)} ${esc(it.unit ?? "")}</td>
      <td class="n">${toRupees(it.price).toFixed(2)}</td>
      <td class="n">${it.discount ? toRupees(it.discount).toFixed(2) : "-"}</td>
      <td class="n">${toRupees(it.taxable).toFixed(2)}</td>
      ${gstOn ? `<td class="c">${it.gst_rate}%</td><td class="n">${toRupees(it.cgst + it.sgst + it.igst).toFixed(2)}</td>` : ""}
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
    .map(
      (p) => `${esc(p.method)} ${rupees(p.amount)}${p.reference ? ` (${esc(p.reference)})` : ""}`,
    )
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
  <div style="display:flex; gap:10px; align-items:flex-start;">
    ${s.logo ? `<img src="${esc(s.logo)}" alt="" style="width:44px;height:44px;border-radius:6px;object-fit:cover;flex-shrink:0;">` : ""}
    <div>
      <div class="biz">${esc(s.businessName)}</div>
      <div class="muted">${esc(s.address)}</div>
      <div class="muted">Phone: ${esc(s.phone)}${s.email ? " &nbsp; " + esc(s.email) : ""}</div>
      ${gstOn ? `<div><b>GSTIN:</b> ${esc(s.gstin)} &nbsp; <b>State:</b> ${esc(s.state)} (${esc(s.stateCode)})</div>` : ""}
    </div>
  </div>
  <div class="n">
    <div><b>Invoice No:</b> ${esc(sale.invoice_number)}</div>
    <div><b>Date:</b> ${esc(new Date(sale.created_at).toLocaleString("en-IN"))}</div>
    <div><b>Billed by:</b> ${esc(sale.created_by)}</div>
  </div>
</div>
<div class="title">${esc(title)}</div>
<div class="grid">
  ${
    sale.customer_name
      ? `<div class="box"><h4>Bill To</h4>
    <div><b>${esc(sale.customer_name)}</b></div>
    <div class="muted">${esc(d.customer?.address ?? "")}</div>
    <div class="muted">${sale.customer_phone ? "Phone: " + esc(sale.customer_phone) : ""}</div>
    <div>${gstOn && d.customer?.gstin ? "<b>GSTIN:</b> " + esc(d.customer.gstin) : ""}</div>
  </div>`
      : ""
  }
  <div class="box"><h4>Supply</h4>
    <div>Place of supply: ${esc(s.state)} (${esc(s.stateCode)})</div>
    <div>Payment: ${pay || "-"}</div>
    <div>Items: ${items.length}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>Description</th>${gstOn ? "<th>HSN</th>" : ""}<th>Qty</th><th>Rate</th><th>Disc</th>
    <th>Taxable</th>${gstOn ? "<th>GST</th><th>Tax</th>" : ""}<th>Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
${pendingDeliveryHtml(d)}
<div class="grid" style="margin-top:8px">
  ${
    gstOn
      ? `<table style="width:52%">
    <thead><tr><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
    <tbody>${tr}</tbody>
  </table>`
      : ""
  }
  <table class="totals">
    <tr><td>Taxable Value</td><td class="n">${rupees(sale.taxable)}</td></tr>
    ${sale.discount ? `<tr><td>Discount</td><td class="n">- ${rupees(sale.discount)}</td></tr>` : ""}
    ${gstOn && sale.cgst ? `<tr><td>CGST</td><td class="n">${rupees(sale.cgst)}</td></tr>` : ""}
    ${gstOn && sale.sgst ? `<tr><td>SGST</td><td class="n">${rupees(sale.sgst)}</td></tr>` : ""}
    ${gstOn && sale.igst ? `<tr><td>IGST</td><td class="n">${rupees(sale.igst)}</td></tr>` : ""}
    ${sale.round_off ? `<tr><td>Round Off</td><td class="n">${rupees(sale.round_off)}</td></tr>` : ""}
    ${sale.transport_charge ? `<tr><td>Transport Charges (Vandi Vadagai)</td><td class="n">${rupees(sale.transport_charge)}</td></tr>` : ""}
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

/** Fixed feedback footer shown on every thermal bill - not business-settings-driven, scoped to this template only. */
const FEEDBACK_PHONE = "+91 91507 51905";
const FEEDBACK_WEB = "www.kvmagencies.in";
const FEEDBACK_QR_DATA_URI =
  "data:image/png;base64,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";

export function invoiceHtmlThermal(
  d: InvoiceData,
  s: BusinessSettings,
  title = "TAX INVOICE",
): string {
  const { sale, items } = d;
  const gstOn = sale.gst_applied !== 0;
  const rows = items
    .map((it) => {
      const qtyRate = `${formatQty(it.qty)} ${esc(it.unit ?? "")} x ${toRupees(it.price).toFixed(2)}`;
      return `<tr><td colspan="3">${esc(it.product_name)}</td></tr>
      <tr><td>${qtyRate}</td>${gstOn ? `<td class="c">${it.gst_rate}%</td>` : "<td></td>"}<td class="n">${toRupees(it.total).toFixed(2)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.invoice_number)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  body { font-family: Calibri, "Segoe UI", Arial, sans-serif; font-weight: 600; font-size: 13px; width: 74mm; color: #000; }
  .c { text-align: center; } .n { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  hr { border: none; border-top: 1px dashed #000; }
  .big { font-size: 18px; font-weight: bold; }
</style></head><body>
<div class="c big">${esc(s.businessName)}</div>
<div class="c">${esc(s.address)}</div>
<div class="c">Ph: ${esc(s.phone)}</div>
${gstOn ? `<div class="c">GSTIN: ${esc(s.gstin)}</div>` : ""}
<div class="c"><b>${esc(title)}</b></div>
<hr>
<div>Bill: ${esc(sale.invoice_number)}</div>
<div>${esc(new Date(sale.created_at).toLocaleString("en-IN"))}</div>
${sale.customer_name ? `<div>Customer: ${esc(sale.customer_name)}${sale.customer_phone ? " (" + esc(sale.customer_phone) + ")" : ""}</div>` : ""}
<hr>
<table>${rows}</table>
${
  d.pendingDeliveries?.length
    ? `<hr><div><b>Pending Delivery</b></div>${d.pendingDeliveries
        .map(
          (p) =>
            `<div>${esc(p.product_name)} — ${formatQty(p.pending_qty)} ${esc(p.unit ?? "")}</div>`,
        )
        .join("")}`
    : ""
}
<hr>
<table>
  <tr><td>Taxable</td><td class="n">${rupees(sale.taxable)}</td></tr>
  ${gstOn ? `<tr><td>GST</td><td class="n">${rupees(sale.cgst + sale.sgst + sale.igst)}</td></tr>` : ""}
  ${sale.round_off ? `<tr><td>Round Off</td><td class="n">${rupees(sale.round_off)}</td></tr>` : ""}
  ${sale.transport_charge ? `<tr><td>Transport (Vandi Vadagai)</td><td class="n">${rupees(sale.transport_charge)}</td></tr>` : ""}
  <tr class="big"><td>TOTAL</td><td class="n">${rupees(sale.total)}</td></tr>
  <tr><td>Paid</td><td class="n">${rupees(sale.paid)}</td></tr>
  ${sale.credit_amount ? `<tr><td>Balance</td><td class="n">${rupees(sale.credit_amount)}</td></tr>` : ""}
</table>
<hr>
<div class="c">${esc(s.invoiceFooter || "Thank you, visit again!")}</div>
<div class="c">Thank You and Visit Again Ph: ${esc(FEEDBACK_PHONE)}</div>
<div class="c">Web: ${esc(FEEDBACK_WEB)}</div>
<div class="c" style="margin-top:6px"><img src="${FEEDBACK_QR_DATA_URI}" alt="" style="width:100px;height:100px;"></div>
<div class="c">Please scan and provide your feedback</div>
</body></html>`;
}

/** A simple delivery note for one Credit Invoice delivery - no prices, just what moved. */
export function deliveryNoteHtml(
  d: {
    invoiceNumber: string;
    customerName: string;
    customerPhone: string;
    productName: string;
    qtyDelivered: string;
    unit: string | null;
    balancePending: string;
  },
  s: BusinessSettings,
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Delivery Note</title>
<style>
  @page { size: A5; margin: 10mm; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 13px; color: #111; }
  .biz { font-size: 16px; font-weight: 700; }
  .title { text-align: center; font-weight: 700; letter-spacing: 1px; margin: 10px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  td { border: 1px solid #999; padding: 6px 8px; }
  .lbl { color: #555; width: 40%; }
</style></head><body>
<div class="biz">${esc(s.businessName)}</div>
<div class="title">DELIVERY NOTE</div>
<table>
  <tr><td class="lbl">Bill No</td><td>${esc(d.invoiceNumber)}</td></tr>
  <tr><td class="lbl">Date</td><td>${esc(new Date().toLocaleString("en-IN"))}</td></tr>
  <tr><td class="lbl">Customer</td><td>${esc(d.customerName)}${d.customerPhone ? " (" + esc(d.customerPhone) + ")" : ""}</td></tr>
  <tr><td class="lbl">Product</td><td>${esc(d.productName)}</td></tr>
  <tr><td class="lbl">Quantity Delivered Today</td><td>${esc(d.qtyDelivered)} ${esc(d.unit ?? "")}</td></tr>
  <tr><td class="lbl">Balance Still Pending</td><td>${esc(d.balancePending)} ${esc(d.unit ?? "")}</td></tr>
</table>
<div style="margin-top:40px; display:flex; justify-content:space-between;">
  <div>Received by: ______________________</div>
  <div>Delivered by: ______________________</div>
</div>
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
  const title = d.sale.gst_applied === 0 ? s.estimateTitle || "ESTIMATE" : "TAX INVOICE";
  printHtml(
    s.printFormat === "THERMAL" ? invoiceHtmlThermal(d, s, title) : invoiceHtmlA4(d, s, title),
  );
}

export { inWords };
