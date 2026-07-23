export interface Customer {
  id: string;
  companyNo: number | null;
  companyName: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  fax: string;
  origin: "excel" | "app";
  createdAt?: number;
  updatedAt?: number;
}

export interface LineItem {
  description: string;
  itemNo: string;
  qty: number;
  unitPrice: number;
  discount: number;
  /** Line total. Copied verbatim from the workbook for imported invoices;
   * computed as (unitPrice - discount) * qty for invoices created in the app. */
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string | null;
  /** Original "2 - Company Name" label from the source sheet (kept for reference). */
  companyLabel?: string;
  date: string | null; // ISO YYYY-MM-DD
  projectDescription: string;
  taxRate: number; // e.g. 0.1 for 10% GST
  other: number;
  deposit: number;
  notes: string;
  lineItems: LineItem[];
  /** Optional status flag for the app (imported rows default to "sent"). */
  status?: "draft" | "sent" | "paid";
  importedDetailTotal?: number;
  importedInvoiceTotal?: number;
  origin: "excel" | "app";
  createdAt?: number;
  updatedAt?: number;
}

export interface CompanyProfile {
  name: string;
  addressLines: string;
  phone: string;
  email: string;
  bankDetails: string;
  paymentTerms: string;
  currency: string;
}

export interface InvoicesMeta {
  generated: string;
  source: string;
  numInvoices: number;
  numCustomers: number;
  numLineItems: number;
}

export interface InvoicesData {
  meta: InvoicesMeta;
  companyProfile: CompanyProfile;
  customers: Customer[];
  invoices: Invoice[];
}

/** Derived monetary totals for an invoice. */
export interface InvoiceTotals {
  subtotal: number;
  gst: number;
  total: number;
}
