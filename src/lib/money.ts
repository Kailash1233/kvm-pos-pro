/**
 * All money is stored in the database as integer paise to avoid
 * floating point accounting errors. Quantities are stored as
 * integer thousandths (milli-units) so 2.5 bags = 2500.
 */

export const QTY_SCALE = 1000;

export function toPaise(rupees: number | string): number {
  const n = typeof rupees === "string" ? parseFloat(rupees || "0") : rupees;
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function toRupees(paise: number): number {
  return (paise || 0) / 100;
}

export function toQty(q: number | string): number {
  const n = typeof q === "string" ? parseFloat(q || "0") : q;
  if (!isFinite(n)) return 0;
  return Math.round(n * QTY_SCALE);
}

export function fromQty(q: number): number {
  return (q || 0) / QTY_SCALE;
}

export function formatQty(q: number): string {
  const v = fromQty(q);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "");
}

export function rupees(paise: number): string {
  const v = toRupees(paise);
  return (
    "\u20B9" +
    v.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/** Compact rupee display for dashboard tiles (no decimals). */
export function rupeesShort(paise: number): string {
  return "\u20B9" + Math.round(toRupees(paise)).toLocaleString("en-IN");
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0.00%";
  return ((part / whole) * 100).toFixed(2) + "%";
}
