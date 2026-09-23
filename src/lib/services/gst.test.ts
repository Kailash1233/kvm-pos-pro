import { describe, it, expect } from "vitest";
import { computeLine, computeBill } from "./gst";

describe("computeLine", () => {
  it("computes taxable value and splits tax evenly across CGST/SGST for intra-state", () => {
    // 10 units at price=1000 paise (Rs 10), 18% GST, no discount.
    const line = computeLine({ qty: 10 * 1000, price: 1000, discount: 0, gstRate: 18 }, false);
    expect(line.amount).toBe(10000); // Rs 100
    expect(line.taxable).toBe(10000);
    expect(line.tax).toBe(1800); // 18% of 10000
    expect(line.cgst).toBe(900);
    expect(line.sgst).toBe(900);
    expect(line.igst).toBe(0);
    expect(line.total).toBe(11800);
  });

  it("routes the whole tax to IGST for interstate sales", () => {
    const line = computeLine({ qty: 1000, price: 1000, discount: 0, gstRate: 18 }, true);
    expect(line.cgst).toBe(0);
    expect(line.sgst).toBe(0);
    expect(line.igst).toBe(180);
  });

  it("taxes the discounted amount, not the gross amount", () => {
    const line = computeLine({ qty: 1000, price: 1000, discount: 200, gstRate: 18 }, false);
    expect(line.taxable).toBe(800);
    expect(line.tax).toBe(144); // 18% of 800
  });

  it("clamps discount so it can never exceed the line amount or go negative", () => {
    const overDiscounted = computeLine(
      { qty: 1000, price: 1000, discount: 5000, gstRate: 18 },
      false,
    );
    expect(overDiscounted.discount).toBe(1000);
    expect(overDiscounted.taxable).toBe(0);

    const negativeDiscount = computeLine(
      { qty: 1000, price: 1000, discount: -500, gstRate: 18 },
      false,
    );
    expect(negativeDiscount.discount).toBe(0);
  });

  it("a 0% GST rate (the no-GST-bill case) produces zero tax on the full price", () => {
    const line = computeLine({ qty: 1000, price: 1000, discount: 0, gstRate: 0 }, false);
    expect(line.taxable).toBe(1000);
    expect(line.tax).toBe(0);
    expect(line.total).toBe(1000);
  });
});

describe("computeBill", () => {
  const twoLines = [
    { qty: 1000, price: 10000, discount: 0, gstRate: 18 }, // Rs 100, 18%
    { qty: 1000, price: 5000, discount: 0, gstRate: 5 }, // Rs 50, 5%
  ];

  it("sums subtotal/taxable/tax across every line", () => {
    const { totals } = computeBill(twoLines, { interstate: false });
    expect(totals.subtotal).toBe(15000);
    expect(totals.taxable).toBe(15000);
    // 18% of 10000 = 1800, 5% of 5000 = 250
    expect(totals.tax).toBe(2050);
  });

  it("spreads a bill-level discount across lines in proportion to taxable value", () => {
    const { totals, lines } = computeBill(twoLines, { interstate: false, billDiscount: 3000 });
    // Line 1 carries 2/3 of taxable value, line 2 carries 1/3.
    expect(lines[0]!.discount).toBe(2000);
    expect(lines[1]!.discount).toBe(1000);
    expect(totals.billDiscount).toBe(3000);
    expect(totals.taxable).toBe(12000);
  });

  it("never lets a bill discount exceed the total taxable value", () => {
    const { totals } = computeBill(twoLines, { interstate: false, billDiscount: 999999 });
    expect(totals.billDiscount).toBe(15000);
    expect(totals.taxable).toBe(0);
  });

  it("rounds the grand total to the nearest rupee by default, tracking the difference", () => {
    const oddLine = [{ qty: 1000, price: 1033, discount: 0, gstRate: 18 }]; // taxable 1033, tax 186 (rounded) = 1219
    const { totals } = computeBill(oddLine, { interstate: false });
    expect(totals.total % 100).toBe(0);
    expect(totals.roundOff).toBe(totals.total - (totals.taxable + totals.tax));
  });

  it("skips rounding when roundOff: false is requested", () => {
    const oddLine = [{ qty: 1000, price: 1033, discount: 0, gstRate: 18 }];
    const { totals } = computeBill(oddLine, { interstate: false, roundOff: false });
    expect(totals.roundOff).toBe(0);
    expect(totals.total).toBe(totals.taxable + totals.tax);
  });

  it("an empty cart totals to zero without dividing by zero", () => {
    const { totals } = computeBill([], { interstate: false, billDiscount: 100 });
    expect(totals.total).toBe(0);
    expect(totals.taxable).toBe(0);
  });
});
