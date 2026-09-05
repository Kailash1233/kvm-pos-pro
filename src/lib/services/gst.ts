/**
 * GST engine. Prices are tax-exclusive per line.
 * All amounts are integer paise, quantities integer milli-units.
 *
 * Rates are never read from the product master when re-printing an old
 * bill - every stored line keeps the rate used at the time of sale.
 */
import { QTY_SCALE } from "../money";

export interface TaxLineInput {
  qty: number;
  price: number;
  discount: number;
  gstRate: number;
}

export interface TaxLine {
  amount: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
}

export function computeLine(input: TaxLineInput, interstate: boolean): TaxLine {
  const amount = Math.round((input.price * input.qty) / QTY_SCALE);
  const discount = Math.min(Math.max(input.discount, 0), amount);
  const taxable = amount - discount;
  const tax = Math.round((taxable * input.gstRate) / 100);
  const cgst = interstate ? 0 : Math.round(tax / 2);
  const sgst = interstate ? 0 : tax - Math.round(tax / 2);
  const igst = interstate ? tax : 0;
  return {
    amount,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    tax: cgst + sgst + igst,
    total: taxable + cgst + sgst + igst,
  };
}

export interface BillTotals {
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  roundOff: number;
  total: number;
}

/**
 * Bill level discount is spread across lines in proportion to their
 * taxable value so the tax per rate slab stays correct.
 */
export function computeBill(
  lines: TaxLineInput[],
  opts: { interstate: boolean; billDiscount?: number; roundOff?: boolean },
): { totals: BillTotals; lines: TaxLine[] } {
  const base = lines.map((l) => computeLine(l, opts.interstate));
  const baseTaxable = base.reduce((s, l) => s + l.taxable, 0);
  const billDiscount = Math.min(Math.max(opts.billDiscount ?? 0, 0), baseTaxable);

  let allocated = 0;
  const final: TaxLine[] = base.map((l, i) => {
    let share =
      baseTaxable === 0 ? 0 : Math.round((billDiscount * l.taxable) / baseTaxable);
    if (i === base.length - 1) share = billDiscount - allocated;
    allocated += share;
    return computeLine(
      {
        ...lines[i]!,
        discount: lines[i]!.discount + share,
      },
      opts.interstate,
    );
  });

  const subtotal = final.reduce((s, l) => s + l.amount, 0);
  const itemDiscount = lines.reduce((s, l) => s + l.discount, 0);
  const taxable = final.reduce((s, l) => s + l.taxable, 0);
  const cgst = final.reduce((s, l) => s + l.cgst, 0);
  const sgst = final.reduce((s, l) => s + l.sgst, 0);
  const igst = final.reduce((s, l) => s + l.igst, 0);
  const gross = taxable + cgst + sgst + igst;
  const rounded = opts.roundOff === false ? gross : Math.round(gross / 100) * 100;
  return {
    totals: {
      subtotal,
      itemDiscount,
      billDiscount,
      discount: itemDiscount + billDiscount,
      taxable,
      cgst,
      sgst,
      igst,
      tax: cgst + sgst + igst,
      roundOff: rounded - gross,
      total: rounded,
    },
    lines: final,
  };
}
