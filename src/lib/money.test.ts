import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  toRupeeNumber,
  toQty,
  fromQty,
  formatQty,
  rupees,
  rupeesShort,
  pct,
  QTY_SCALE,
} from "./money";

describe("toPaise", () => {
  it("converts rupees to integer paise", () => {
    expect(toPaise(10)).toBe(1000);
    expect(toPaise(10.5)).toBe(1050);
    expect(toPaise("380")).toBe(38000);
    expect(toPaise("380.75")).toBe(38075);
  });

  it("never produces float drift", () => {
    // 0.1 + 0.2 famously isn't 0.3 in raw floating point.
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
  });

  it("treats missing/invalid input as zero", () => {
    expect(toPaise("")).toBe(0);
    expect(toPaise(NaN)).toBe(0);
  });

  it("rounds to the nearest paisa", () => {
    expect(toPaise(10.005)).toBe(1001); // 1000.5 rounds up
  });
});

describe("toRupees / toRupeeNumber", () => {
  it("converts paise back to rupees", () => {
    expect(toRupees(1000)).toBe(10);
    expect(toRupees(38075)).toBe(380.75);
  });

  it("toRupeeNumber is spreadsheet-safe (2 decimals, no drift)", () => {
    expect(toRupeeNumber(333)).toBe(3.33);
    expect(toRupeeNumber(0)).toBe(0);
  });
});

describe("qty helpers", () => {
  it("round-trips through the milli-unit scale", () => {
    expect(toQty(2.5)).toBe(2500);
    expect(fromQty(2500)).toBe(2.5);
    expect(QTY_SCALE).toBe(1000);
  });

  it("formatQty trims trailing zeros but keeps whole numbers clean", () => {
    expect(formatQty(1000)).toBe("1");
    expect(formatQty(2500)).toBe("2.5");
    expect(formatQty(1250)).toBe("1.25");
  });
});

describe("display formatting", () => {
  it("rupees() renders the rupee sign with 2 decimals, Indian grouping", () => {
    expect(rupees(150000)).toBe("₹1,500.00");
    expect(rupees(0)).toBe("₹0.00");
  });

  it("rupeesShort() drops decimals for compact tiles", () => {
    expect(rupeesShort(150000)).toBe("₹1,500");
  });

  it("pct() guards against divide-by-zero", () => {
    expect(pct(50, 0)).toBe("0.00%");
    expect(pct(25, 100)).toBe("25.00%");
  });
});
