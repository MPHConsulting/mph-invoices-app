import { useMemo, useState } from "react";
import type { Customer, Invoice } from "../types";
import { fmtDate, fmtMoney, invoiceTotals } from "../lib/format";

interface Props {
  invoices: Invoice[];
  customers: Customer[];
  onOpen: (inv: Invoice) => void;
  onNew: () => void;
}

export function InvoiceList({ invoices, customers, onOpen, onNew }: Props) {
  const [query, setQuery] = useState("");
  const custById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const customerName = (inv: Invoice) =>
    (inv.customerId && custById.get(inv.customerId)?.companyName) || inv.companyLabel || "—";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter((inv) =>
      [inv.invoiceNo, inv.projectDescription, inv.notes, customerName(inv)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [invoices, query, custById]);

  const grandTotal = useMemo(
    () => filtered.reduce((s, inv) => s + invoiceTotals(inv).total, 0),
    [filtered],
  );

  return (
    <div className="space-y-4">
      {invoices.length === 0 && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          No invoices on this device yet. Go to <span className="font-semibold">Settings → Automatic
          cloud sync</span> and connect your GitHub token to load your invoice history, or press{" "}
          <span className="font-semibold">New invoice</span> to start one.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoices, clients, descriptions…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <div className="ml-auto flex items-center gap-4 text-sm text-slate-600">
          <span>
            <span className="text-slate-400">Showing </span>
            <span className="font-semibold tabular-nums">{filtered.length}</span>
          </span>
          <span>
            <span className="text-slate-400">Total </span>
            <span className="font-semibold tabular-nums">{fmtMoney(grandTotal)}</span>
          </span>
          <button
            onClick={onNew}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            + New invoice
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2.5 font-semibold">Invoice #</th>
              <th className="px-3 py-2.5 font-semibold">Date</th>
              <th className="px-3 py-2.5 font-semibold">Client</th>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total</th>
              <th className="px-3 py-2.5 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => onOpen(inv)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-sky-50"
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                  {inv.invoiceNo}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                  {fmtDate(inv.date)}
                </td>
                <td className="px-3 py-2.5 text-slate-700">{customerName(inv)}</td>
                <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-600">
                  {inv.projectDescription}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-800">
                  {fmtMoney(invoiceTotals(inv).total)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <StatusBadge status={inv.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: Invoice["status"] }) {
  const s = status ?? "sent";
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    sent: "bg-sky-100 text-sky-700",
    paid: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[s]}`}>
      {s}
    </span>
  );
}
