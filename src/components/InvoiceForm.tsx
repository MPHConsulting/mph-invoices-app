import { useMemo, useState } from "react";
import type { Customer, Invoice, LineItem } from "../types";
import { computeLineAmount, fmtMoney, round2 } from "../lib/format";

interface Props {
  initial: Invoice | null;
  customers: Customer[];
  suggestedNo: string;
  onSave: (inv: Invoice) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onCreateCustomer: (c: Customer) => Promise<void>;
}

interface DraftItem {
  description: string;
  itemNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
}

const ADD_NEW = "__add_new__";

function genId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function toDraftItems(inv: Invoice | null): DraftItem[] {
  if (inv && inv.lineItems.length) {
    return inv.lineItems.map((i) => ({
      description: i.description,
      itemNo: i.itemNo,
      qty: i.qty,
      unitPrice: i.unitPrice,
      discount: i.discount,
    }));
  }
  return [{ description: "", itemNo: "1", qty: 1, unitPrice: 0, discount: 0 }];
}

export function InvoiceForm({
  initial,
  customers,
  suggestedNo,
  onSave,
  onCancel,
  onDelete,
  onCreateCustomer,
}: Props) {
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? suggestedNo);
  const [customerId, setCustomerId] = useState<string | null>(initial?.customerId ?? null);
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [projectDescription, setProjectDescription] = useState(initial?.projectDescription ?? "");
  const [taxRatePct, setTaxRatePct] = useState(round2((initial?.taxRate ?? 0) * 100));
  const [other, setOther] = useState(initial?.other ?? 0);
  const [deposit, setDeposit] = useState(initial?.deposit ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<Invoice["status"]>(initial?.status ?? "draft");
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(initial));

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Customer>>({});
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => round2(items.reduce((s, i) => s + computeLineAmount(i), 0)),
    [items],
  );
  const gst = round2(subtotal * (taxRatePct / 100));
  const total = round2(subtotal + gst + Number(other || 0) - Number(deposit || 0));

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [
      ...prev,
      { description: "", itemNo: String(prev.length + 1), qty: 1, unitPrice: 0, discount: 0 },
    ]);
  }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function saveNewClient() {
    if (!newClient.companyName?.trim()) {
      setError("Enter a company name for the new client.");
      return;
    }
    const c: Customer = {
      id: genId("cust"),
      companyNo: null,
      companyName: newClient.companyName.trim(),
      contactName: newClient.contactName ?? "",
      address: newClient.address ?? "",
      city: newClient.city ?? "",
      state: newClient.state ?? "",
      zip: newClient.zip ?? "",
      phone: newClient.phone ?? "",
      email: newClient.email ?? "",
      fax: "",
      origin: "app",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await onCreateCustomer(c);
    setCustomerId(c.id);
    setShowNewClient(false);
    setNewClient({});
    setError(null);
  }

  function handleSubmit() {
    if (!invoiceNo.trim()) return setError("Invoice number is required.");
    if (!items.some((i) => i.description.trim())) return setError("Add at least one line item.");
    setError(null);

    const lineItems: LineItem[] = items
      .filter((i) => i.description.trim())
      .map((i, idx) => ({
        description: i.description.trim(),
        itemNo: i.itemNo?.trim() || String(idx + 1),
        qty: Number(i.qty) || 0,
        unitPrice: Number(i.unitPrice) || 0,
        discount: Number(i.discount) || 0,
        amount: computeLineAmount(i),
      }));

    const now = Date.now();
    const inv: Invoice = {
      id: initial?.id ?? genId("inv"),
      invoiceNo: invoiceNo.trim(),
      customerId,
      companyLabel: initial?.companyLabel,
      date: date || null,
      projectDescription: projectDescription.trim(),
      taxRate: round2(taxRatePct / 100 || 0),
      other: Number(other) || 0,
      deposit: Number(deposit) || 0,
      notes: notes.trim(),
      lineItems,
      status,
      importedDetailTotal: initial?.importedDetailTotal,
      importedInvoiceTotal: initial?.importedInvoiceTotal,
      origin: initial?.origin ?? "app",
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(inv);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Header fields */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Invoice #">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Invoice date">
          <input type="date" value={date ?? ""} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Invoice["status"])}
            className={inputCls}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
          </select>
        </Field>

        <Field label="Client">
          <select
            value={customerId ?? ""}
            onChange={(e) => {
              if (e.target.value === ADD_NEW) {
                setShowNewClient(true);
              } else {
                setCustomerId(e.target.value || null);
              }
            }}
            className={inputCls}
          >
            <option value="">— Select a client —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
            <option value={ADD_NEW}>＋ Add new client…</option>
          </select>
        </Field>

        <Field label="Invoice for (project)" className="sm:col-span-2">
          <input
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="e.g. Navigation Logs"
            className={inputCls}
          />
        </Field>
      </div>

      {showNewClient && (
        <div className="rounded-lg border border-brand/30 bg-sky-50/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Add a new client</h3>
            <button
              onClick={() => setShowNewClient(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input placeholder="Company name *" className={inputCls} value={newClient.companyName ?? ""} onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })} />
            <input placeholder="Contact name" className={inputCls} value={newClient.contactName ?? ""} onChange={(e) => setNewClient({ ...newClient, contactName: e.target.value })} />
            <input placeholder="Email" className={inputCls} value={newClient.email ?? ""} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
            <input placeholder="Address" className={inputCls} value={newClient.address ?? ""} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
            <input placeholder="City" className={inputCls} value={newClient.city ?? ""} onChange={(e) => setNewClient({ ...newClient, city: e.target.value })} />
            <div className="flex gap-3">
              <input placeholder="State" className={inputCls} value={newClient.state ?? ""} onChange={(e) => setNewClient({ ...newClient, state: e.target.value })} />
              <input placeholder="ZIP" className={inputCls} value={newClient.zip ?? ""} onChange={(e) => setNewClient({ ...newClient, zip: e.target.value })} />
            </div>
            <input placeholder="Phone" className={inputCls} value={newClient.phone ?? ""} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
          </div>
          <button
            onClick={saveNewClient}
            className="mt-3 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Add client
          </button>
        </div>
      )}

      {/* Line items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Line items</h3>
          <button onClick={addItem} className="text-sm font-medium text-brand hover:text-brand-dark">
            + Add line
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 font-semibold">Item #</th>
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">Qty</th>
                <th className="px-2 py-2 font-semibold">Unit price</th>
                <th className="px-2 py-2 font-semibold">Discount</th>
                <th className="px-2 py-2 text-right font-semibold">Amount</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1.5">
                    <input value={it.itemNo} onChange={(e) => updateItem(idx, { itemNo: e.target.value })} className={`${cellCls} w-16`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} className={`${cellCls} w-full min-w-[180px]`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="any" value={it.qty} onChange={(e) => updateItem(idx, { qty: parseFloat(e.target.value) || 0 })} className={`${cellCls} w-20 text-right`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="any" value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })} className={`${cellCls} w-28 text-right`} />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" step="any" value={it.discount} onChange={(e) => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })} className={`${cellCls} w-24 text-right`} />
                  </td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums text-slate-700">
                    {fmtMoney(computeLineAmount(it))}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => removeItem(idx)}
                      className="text-slate-400 hover:text-red-500"
                      title="Remove line"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Amount = (Unit price − Discount) × Qty. Discount is per unit.
        </p>
      </div>

      {/* Totals + adjustments */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="GST / Tax rate (%)">
            <input type="number" step="any" value={taxRatePct} onChange={(e) => setTaxRatePct(parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Other">
            <input type="number" step="any" value={other} onChange={(e) => setOther(parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Deposit received">
            <input type="number" step="any" value={deposit} onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)} className={inputCls} />
          </Field>
          <Field label="Notes" className="sm:col-span-3">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <Row label="Subtotal" value={fmtMoney(subtotal)} />
          {taxRatePct > 0 && <Row label={`GST (${round2(taxRatePct)}%)`} value={fmtMoney(gst)} />}
          {Number(other) !== 0 && <Row label="Other" value={fmtMoney(Number(other))} />}
          {Number(deposit) !== 0 && <Row label="Deposit received" value={`-${fmtMoney(Number(deposit))}`} />}
          <div className="mt-2 border-t border-slate-300 pt-2">
            <Row label="TOTAL (AUD)" value={fmtMoney(total)} strong />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSubmit}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          {initial ? "Save changes" : "Create invoice"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        {initial && onDelete && (
          <button
            onClick={() => {
              if (confirm(`Delete invoice ${initial.invoiceNo}? This cannot be undone.`))
                onDelete(initial.id);
            }}
            className="ml-auto rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete invoice
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";
const cellCls =
  "rounded border border-slate-200 px-2 py-1 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 text-sm ${strong ? "font-bold text-brand" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
