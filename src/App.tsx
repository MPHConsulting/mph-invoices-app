import { useEffect, useMemo, useState } from "react";
import { InvoiceList } from "./components/InvoiceList";
import { InvoiceForm } from "./components/InvoiceForm";
import { InvoicePreview } from "./components/InvoicePreview";
import { CustomersPage } from "./components/CustomersPage";
import { SettingsPage } from "./components/SettingsPage";
import {
  deleteCustomer,
  deleteInvoice,
  ensureSeeded,
  getAllCustomers,
  getAllInvoices,
  getCompanyProfile,
  nextInvoiceNo,
  putCompanyProfile,
  putCustomer,
  putInvoice,
} from "./lib/db";
import { scheduleAutoBackup, syncOnOpen } from "./lib/gistBackup";
import type { CompanyProfile, Customer, Invoice } from "./types";

type View = "list" | "form" | "preview" | "customers" | "settings";

const TABS = [
  ["list", "Invoices"],
  ["customers", "Clients"],
  ["settings", "Settings"],
] as const;

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);

  async function reload() {
    const [inv, cust, prof] = await Promise.all([
      getAllInvoices(),
      getAllCustomers(),
      getCompanyProfile(),
    ]);
    setInvoices(inv);
    setCustomers(cust);
    setProfile(prof);
    // Keep the currently open invoice in sync with reloaded data.
    setSelected((s) => (s ? (inv.find((i) => i.id === s.id) ?? s) : s));
  }

  useEffect(() => {
    (async () => {
      await ensureSeeded();
      await reload();
      setLoading(false);
      try {
        const r = await syncOnOpen();
        if (r.changed) await reload();
      } catch (e) {
        console.warn("Cloud sync on open failed:", e);
      }
    })();
  }, []);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await syncOnOpen();
        if (r.changed) await reload();
      } catch (e) {
        console.warn("Cloud sync on focus failed:", e);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const custById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  function openNew() {
    setEditing(null);
    setView("form");
  }
  function openInvoice(inv: Invoice) {
    setSelected(inv);
    setView("preview");
  }
  function editInvoice(inv: Invoice) {
    setEditing(inv);
    setView("form");
  }

  async function handleSaveInvoice(inv: Invoice) {
    await putInvoice(inv);
    await reload();
    setEditing(null);
    setSelected(inv);
    setView("preview");
    scheduleAutoBackup();
  }

  async function handleDeleteInvoice(id: string) {
    await deleteInvoice(id);
    await reload();
    setEditing(null);
    setSelected(null);
    setView("list");
    scheduleAutoBackup();
  }

  async function handleCreateCustomer(c: Customer) {
    await putCustomer(c);
    await reload();
    scheduleAutoBackup();
  }

  async function handleSaveCustomer(c: Customer) {
    await putCustomer(c);
    await reload();
    scheduleAutoBackup();
  }

  async function handleDeleteCustomer(id: string) {
    await deleteCustomer(id);
    await reload();
    scheduleAutoBackup();
  }

  async function handleSaveProfile(p: CompanyProfile) {
    const stamped = { ...p, updatedAt: new Date().toISOString() };
    await putCompanyProfile(stamped);
    setProfile(stamped);
    scheduleAutoBackup();
  }

  if (loading || !profile) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">Loading invoices…</div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-8 w-8 rounded-full object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <h1 className="text-lg font-semibold tracking-tight">MPH Invoices</h1>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-white sm:hidden"
              value={TABS.some(([v]) => v === view) ? view : "list"}
              onChange={(e) => {
                setEditing(null);
                setView(e.target.value as View);
              }}
            >
              {TABS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <nav className="hidden items-center gap-1 rounded-md bg-slate-800 p-1 text-sm sm:flex">
              {TABS.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    setEditing(null);
                    setView(v);
                  }}
                  className={`rounded px-3 py-1 font-medium ${
                    view === v || (v === "list" && (view === "form" || view === "preview"))
                      ? "bg-brand text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
            <button
              onClick={openNew}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold hover:bg-brand-dark"
            >
              + New invoice
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">
        {view === "form" ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-4 text-base font-semibold">
              {editing ? `Edit invoice ${editing.invoiceNo}` : "New invoice"}
            </h2>
            <InvoiceForm
              initial={editing}
              customers={customers}
              suggestedNo={nextInvoiceNo(invoices)}
              onSave={handleSaveInvoice}
              onCancel={() => (editing ? openInvoice(editing) : setView("list"))}
              onDelete={editing ? handleDeleteInvoice : undefined}
              onCreateCustomer={handleCreateCustomer}
            />
          </div>
        ) : view === "preview" && selected ? (
          <InvoicePreview
            invoice={selected}
            customer={selected.customerId ? (custById.get(selected.customerId) ?? null) : null}
            company={profile}
            onEdit={() => editInvoice(selected)}
            onBack={() => setView("list")}
          />
        ) : view === "customers" ? (
          <CustomersPage
            customers={customers}
            onSave={handleSaveCustomer}
            onDelete={handleDeleteCustomer}
          />
        ) : view === "settings" ? (
          <SettingsPage profile={profile} onSaveProfile={handleSaveProfile} onRestored={reload} />
        ) : (
          <InvoiceList
            invoices={invoices}
            customers={customers}
            onOpen={openInvoice}
            onNew={openNew}
          />
        )}
      </main>
    </div>
  );
}
