import type { Invoice, InvoiceTotals, LineItem } from "../types";

/** Line total for an item created in the app: (unitPrice - discount) * qty. */
export function computeLineAmount(item: Pick<LineItem, "qty" | "unitPrice" | "discount">): number {
  return round2((item.unitPrice - item.discount) * item.qty);
}

/** Derived subtotal / GST / total for an invoice. */
export function invoiceTotals(inv: Invoice): InvoiceTotals {
  const subtotal = round2(inv.lineItems.reduce((s, i) => s + (i.amount || 0), 0));
  const gst = round2(subtotal * (inv.taxRate || 0));
  const total = round2(subtotal + gst + (inv.other || 0) - (inv.deposit || 0));
  return { subtotal, gst, total };
}

export function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** Money formatted with thousands separators and 2 decimals (no symbol). */
export function fmtMoney(v: number): string {
  return (v || 0).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Money with currency code suffix, e.g. "3,750.00 AUD". */
export function fmtMoneyCcy(v: number, currency = "AUD"): string {
  return `${fmtMoney(v)} ${currency}`;
}

/** ISO date -> "dd/mm/yyyy". */
export function fmtDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(date + "T00:00:00");
  if (Number.isNaN(d.getTime())) return date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "never" : d.toLocaleString();
}

/** Percentage from a rate, e.g. 0.1 -> "10%". */
export function fmtPct(rate: number): string {
  return `${round2((rate || 0) * 100)}%`;
}
