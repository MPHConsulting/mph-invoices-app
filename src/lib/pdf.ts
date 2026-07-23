import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CompanyProfile, Customer, Invoice } from "../types";
import { fmtDate, fmtMoney, invoiceTotals } from "./format";

const BRAND: [number, number, number] = [47, 109, 163]; // #2f6da3
const DARK: [number, number, number] = [15, 23, 42];
const GREY: [number, number, number] = [100, 116, 139];

let logoCache: string | null | undefined;

/** Load /logo.png once as a data URL for embedding into PDFs. */
async function loadLogo(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const url = `${import.meta.env.BASE_URL}logo.png`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    logoCache = null;
  }
  return logoCache;
}

/** Strip characters Windows/macOS forbid in filenames and tidy whitespace. */
function sanitizeFilePart(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, "");
}

/** Zero-pad a "YYYY-N" invoice number to "YYYY-NN" so filenames sort correctly. */
function padInvoiceNo(no: string): string {
  const m = /^(\d{4})-(\d+)$/.exec(no.trim());
  return m ? `${m[1]}-${m[2].padStart(2, "0")}` : no.trim();
}

/**
 * PDF filename: "<Company Name> - <YYYY>-<NN>.pdf". Company first (so a folder
 * groups by client) and the zero-padded number keeps each client's invoices in
 * oldest-to-newest order.
 */
export function invoiceFileName(inv: Invoice, customer: Customer | null): string {
  const company = sanitizeFilePart(customer?.companyName || inv.companyLabel || "Unknown");
  return `${company} - ${padInvoiceNo(inv.invoiceNo)}.pdf`;
}

/** Build a styled PDF for an invoice and return it as a Blob + filename. */
export async function buildInvoicePdf(
  inv: Invoice,
  customer: Customer | null,
  company: CompanyProfile,
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  const currency = company.currency || "AUD";
  const logo = await loadLogo();

  // --- Header: logo + company block on the left, INVOICE title on the right ---
  let y = margin;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, y, 64, 64);
    } catch {
      /* ignore bad image */
    }
  }
  const textX = logo ? margin + 78 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(company.name || "MPH Consulting", textX, y + 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  const companyLines = [
    ...(company.addressLines ? company.addressLines.split("\n") : []),
    ...(company.phone ? [`P: ${company.phone}`] : []),
    ...(company.email ? [`E: ${company.email}`] : []),
  ];
  doc.text(companyLines, textX, y + 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BRAND);
  doc.text("INVOICE", pageW - margin, y + 16, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  const metaLines = [
    `Invoice #: ${inv.invoiceNo}`,
    `Date: ${fmtDate(inv.date)}`,
  ];
  doc.text(metaLines, pageW - margin, y + 34, { align: "right" });

  y += 88;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1.2);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // --- Bill To + Invoice For ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const billLines: string[] = [];
  if (customer) {
    if (customer.companyName) billLines.push(customer.companyName);
    if (customer.contactName) billLines.push(customer.contactName);
    if (customer.address) billLines.push(customer.address);
    const cityLine = [customer.city, customer.state, customer.zip].filter(Boolean).join(" ");
    if (cityLine) billLines.push(cityLine);
    if (customer.phone) billLines.push(`Phone: ${customer.phone}`);
    if (customer.email) billLines.push(`Email: ${customer.email}`);
  } else {
    billLines.push(inv.companyLabel || "—");
  }
  doc.text(billLines, margin, y + 14);

  if (inv.projectDescription) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND);
    doc.text("INVOICE FOR", pageW / 2, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(doc.splitTextToSize(inv.projectDescription, pageW / 2 - margin), pageW / 2, y + 14);
  }

  const tableTop = y + 14 + billLines.length * 12 + 16;

  // --- Line items table ---
  autoTable(doc, {
    startY: tableTop,
    margin: { left: margin, right: margin },
    head: [["Item #", "Description", "Qty", "Unit Price", "Discount", "Price"]],
    body: inv.lineItems.map((it, i) => [
      it.itemNo || String(i + 1),
      it.description,
      formatQty(it.qty),
      fmtMoney(it.unitPrice),
      fmtMoney(it.discount),
      fmtMoney(it.amount),
    ]),
    styles: { fontSize: 9, cellPadding: 5, textColor: DARK },
    headStyles: { fillColor: BRAND, textColor: 255, halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 45 },
      2: { halign: "center", cellWidth: 40 },
      3: { halign: "right", cellWidth: 70 },
      4: { halign: "right", cellWidth: 65 },
      5: { halign: "right", cellWidth: 75 },
    },
    alternateRowStyles: { fillColor: [244, 247, 250] as [number, number, number] },
  });

  const totals = invoiceTotals(inv);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ty = (doc as any).lastAutoTable.finalY + 16;

  // --- Totals block (right aligned) ---
  const labelX = pageW - margin - 150;
  const valueX = pageW - margin;
  const rows: Array<[string, string]> = [["Subtotal", fmtMoney(totals.subtotal)]];
  if (inv.taxRate) rows.push([`GST (${Math.round(inv.taxRate * 100)}%)`, fmtMoney(totals.gst)]);
  if (inv.other) rows.push(["Other", fmtMoney(inv.other)]);
  if (inv.deposit) rows.push(["Deposit received", `-${fmtMoney(inv.deposit)}`]);

  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GREY);
    doc.text(label, labelX, ty);
    doc.setTextColor(...DARK);
    doc.text(value, valueX, ty, { align: "right" });
    ty += 15;
  }
  ty += 2;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.8);
  doc.line(labelX, ty, valueX, ty);
  ty += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text(`TOTAL (${currency})`, labelX, ty);
  doc.text(fmtMoney(totals.total), valueX, ty, { align: "right" });

  // --- Footer: bank details + payment terms ---
  let fy = Math.max(ty + 40, doc.internal.pageSize.getHeight() - 120);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.6);
  doc.line(margin, fy - 16, pageW - margin, fy - 16);
  if (company.bankDetails) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND);
    doc.text("Electronic transfer details", margin, fy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(company.bankDetails.split("\n"), margin, fy + 13);
    fy += 13 + company.bankDetails.split("\n").length * 12;
  }
  if (company.paymentTerms) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(doc.splitTextToSize(company.paymentTerms, pageW - margin * 2), margin, fy + 6);
  }

  const blob = doc.output("blob");
  return { blob, filename: invoiceFileName(inv, customer) };
}

function formatQty(q: number): string {
  return Number.isInteger(q) ? String(q) : String(q);
}
