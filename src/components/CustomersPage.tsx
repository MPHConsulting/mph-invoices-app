import { useState } from "react";
import type { Customer } from "../types";

interface Props {
  customers: Customer[];
  onSave: (c: Customer) => void;
  onDelete: (id: string) => void;
}

function genId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `cust-${uuid}`;
}

function blank(): Customer {
  return {
    id: genId(),
    companyNo: null,
    companyName: "",
    contactName: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    fax: "",
    origin: "app",
  };
}

export function CustomersPage({ customers, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState<Customer | null>(null);
  const [isNew, setIsNew] = useState(false);

  function startNew() {
    setEditing(blank());
    setIsNew(true);
  }
  function startEdit(c: Customer) {
    setEditing({ ...c });
    setIsNew(false);
  }
  function save() {
    if (!editing) return;
    if (!editing.companyName.trim()) return;
    const now = Date.now();
    onSave({ ...editing, updatedAt: now, createdAt: editing.createdAt ?? now });
    setEditing(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Clients</h2>
        <button
          onClick={startNew}
          className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Add client
        </button>
      </div>

      {editing && (
        <div className="rounded-lg border border-brand/30 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            {isNew ? "New client" : `Edit ${editing.companyName}`}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Company name *" value={editing.companyName} onChange={(v) => setEditing({ ...editing, companyName: v })} />
            <Input label="Contact name" value={editing.contactName} onChange={(v) => setEditing({ ...editing, contactName: v })} />
            <Input label="Email" value={editing.email} onChange={(v) => setEditing({ ...editing, email: v })} />
            <Input label="Phone" value={editing.phone} onChange={(v) => setEditing({ ...editing, phone: v })} />
            <Input label="Address" value={editing.address} onChange={(v) => setEditing({ ...editing, address: v })} />
            <Input label="City" value={editing.city} onChange={(v) => setEditing({ ...editing, city: v })} />
            <Input label="State" value={editing.state} onChange={(v) => setEditing({ ...editing, state: v })} />
            <Input label="ZIP / Postcode" value={editing.zip} onChange={(v) => setEditing({ ...editing, zip: v })} />
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              Save client
            </button>
            <button onClick={() => setEditing(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {customers.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">{c.companyName}</div>
              <div className="truncate text-sm text-slate-500">
                {[c.contactName, c.email, [c.city, c.state].filter(Boolean).join(", ")]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button onClick={() => startEdit(c)} className="rounded px-2 py-1 text-sm font-medium text-brand hover:bg-sky-50">
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete client ${c.companyName}?`)) onDelete(c.id);
              }}
              className="rounded px-2 py-1 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        ))}
        {customers.length === 0 && (
          <div className="px-4 py-10 text-center text-slate-400">No clients yet.</div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}
