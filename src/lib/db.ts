import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CompanyProfile, Customer, Invoice } from "../types";
import { seedData } from "../data/seed";

interface InvoicesDB extends DBSchema {
  invoices: { key: string; value: Invoice };
  customers: { key: string; value: Customer };
  meta: { key: string; value: unknown };
}

const DB_NAME = "mph-invoices";
const DB_VERSION = 1;
// Bump to re-seed the imported ("excel") records after a data rebuild.
// The public build ships an EMPTY seed: the invoice history is private and lives
// in the user's cloud-sync Gist, pulled in after they connect their token.
const SEED_VERSION = "2026-07-23-empty";

let dbPromise: Promise<IDBPDatabase<InvoicesDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<InvoicesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("invoices")) {
          db.createObjectStore("invoices", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Seed the bundled Excel history on first run. Imported ("excel") records are
 * refreshed from the bundle on a seed-version bump; any invoices/customers the
 * user created in the app (origin "app") are preserved. The company profile is
 * only written if none exists yet, so the user's edits survive re-seeds.
 */
export async function ensureSeeded(): Promise<void> {
  const db = await getDb();
  const seeded = await db.get("meta", "seedVersion");
  if (seeded === SEED_VERSION) return;

  const tx = db.transaction(["invoices", "customers", "meta"], "readwrite");
  const invStore = tx.objectStore("invoices");
  for (const inv of await invStore.getAll()) {
    if (inv.origin === "excel") await invStore.delete(inv.id);
  }
  for (const inv of seedData.invoices) {
    await invStore.put({ status: "sent", ...inv });
  }

  const custStore = tx.objectStore("customers");
  for (const c of await custStore.getAll()) {
    if (c.origin === "excel") await custStore.delete(c.id);
  }
  for (const c of seedData.customers) await custStore.put(c);

  const meta = tx.objectStore("meta");
  const existingProfile = await meta.get("companyProfile");
  if (!existingProfile) await meta.put(seedData.companyProfile, "companyProfile");
  await meta.put(seedData.meta, "sourceMeta");
  await meta.put(SEED_VERSION, "seedVersion");
  await tx.done;
}

export async function getAllInvoices(): Promise<Invoice[]> {
  const db = await getDb();
  const all = await db.getAll("invoices");
  return all.sort(compareInvoices);
}

/** Newest first: by date desc, then by invoice number desc. */
export function compareInvoices(a: Invoice, b: Invoice): number {
  const da = a.date || "0000-00-00";
  const dbb = b.date || "0000-00-00";
  if (da !== dbb) return da < dbb ? 1 : -1;
  return compareInvoiceNo(b.invoiceNo, a.invoiceNo);
}

/** Compare "YYYY-N" invoice numbers numerically where possible. */
export function compareInvoiceNo(a: string, b: string): number {
  const pa = parseInvoiceNo(a);
  const pb = parseInvoiceNo(b);
  if (pa && pb) {
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.seq - pb.seq;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function parseInvoiceNo(no: string): { year: number; seq: number } | null {
  const m = /^(\d{4})-(\d+)$/.exec(no.trim());
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

/** Suggest the next invoice number for the current year (e.g. "2026-3"). */
export function nextInvoiceNo(invoices: Invoice[], year = new Date().getFullYear()): string {
  let maxSeq = 0;
  for (const inv of invoices) {
    const p = parseInvoiceNo(inv.invoiceNo);
    if (p && p.year === year && p.seq > maxSeq) maxSeq = p.seq;
  }
  return `${year}-${maxSeq + 1}`;
}

export async function putInvoice(inv: Invoice): Promise<void> {
  const db = await getDb();
  await db.put("invoices", inv);
}

export async function deleteInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("invoices", id);
}

export async function getAllCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const all = await db.getAll("customers");
  return all.sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function putCustomer(c: Customer): Promise<void> {
  const db = await getDb();
  await db.put("customers", c);
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("customers", id);
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const db = await getDb();
  const p = (await db.get("meta", "companyProfile")) as CompanyProfile | undefined;
  return p ?? seedData.companyProfile;
}

export async function putCompanyProfile(p: CompanyProfile): Promise<void> {
  const db = await getDb();
  await db.put("meta", p, "companyProfile");
}

/** A full snapshot of everything on this device, for backup / restore / sync. */
export interface BackupBundle {
  app: "mph-invoices";
  version: number;
  exportedAt: string;
  invoices: Invoice[];
  customers: Customer[];
  meta: {
    companyProfile?: CompanyProfile;
    sourceMeta?: unknown;
    seedVersion?: unknown;
  };
}

export async function exportData(): Promise<BackupBundle> {
  const db = await getDb();
  const [invoices, customers, companyProfile, sourceMeta, seedVersion] = await Promise.all([
    db.getAll("invoices"),
    db.getAll("customers"),
    db.get("meta", "companyProfile") as Promise<CompanyProfile | undefined>,
    db.get("meta", "sourceMeta"),
    db.get("meta", "seedVersion"),
  ]);
  return {
    app: "mph-invoices",
    version: 1,
    exportedAt: new Date().toISOString(),
    invoices,
    customers,
    meta: { companyProfile, sourceMeta, seedVersion },
  };
}

export async function importData(bundle: BackupBundle): Promise<void> {
  if (!bundle || bundle.app !== "mph-invoices" || !Array.isArray(bundle.invoices)) {
    throw new Error("This file is not a valid MPH Invoices backup.");
  }
  const db = await getDb();
  const tx = db.transaction(["invoices", "customers", "meta"], "readwrite");
  const invoices = tx.objectStore("invoices");
  await invoices.clear();
  for (const inv of bundle.invoices) await invoices.put(inv);

  const customers = tx.objectStore("customers");
  await customers.clear();
  for (const c of bundle.customers ?? []) await customers.put(c);

  const meta = tx.objectStore("meta");
  if (bundle.meta?.companyProfile) await meta.put(bundle.meta.companyProfile, "companyProfile");
  if (bundle.meta?.sourceMeta !== undefined) await meta.put(bundle.meta.sourceMeta, "sourceMeta");
  if (bundle.meta?.seedVersion !== undefined) await meta.put(bundle.meta.seedVersion, "seedVersion");
  await tx.done;
}
