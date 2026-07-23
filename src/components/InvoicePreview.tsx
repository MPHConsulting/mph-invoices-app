import { useEffect, useState } from "react";
import type { CompanyProfile, Customer, Invoice } from "../types";
import { fmtDate, fmtMoney, invoiceTotals, round2 } from "../lib/format";
import { buildInvoicePdf } from "../lib/pdf";
import { downloadBlob, emailViaGmail } from "../lib/share";
import { getFolderName, isFolderSaveSupported, savePdfToFolder } from "../lib/fsAccess";

interface Props {
  invoice: Invoice;
  customer: Customer | null;
  company: CompanyProfile;
  onEdit: () => void;
  onBack: () => void;
}

export function InvoicePreview({ invoice, customer, company, onEdit, onBack }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const folderSupported = isFolderSaveSupported();
  const totals = invoiceTotals(invoice);
  const currency = company.currency || "AUD";

  function buildEmail() {
    const to = customer?.email ?? "";
    const subject = `Invoice ${invoice.invoiceNo} from ${company.name}`;
    const body =
      `Hi ${customer?.contactName || customer?.companyName || "there"},\n\n` +
      `Please find attached invoice ${invoice.invoiceNo}` +
      (invoice.projectDescription ? ` for ${invoice.projectDescription}` : "") +
      `, totalling ${fmtMoney(totals.total)} ${currency}.\n\n` +
      `Kind regards,\n${company.name}`;
    return { to, subject, body };
  }

  useEffect(() => {
    if (folderSupported) getFolderName().then(setFolderName);
  }, [folderSupported]);

  async function saveToFolder() {
    setBusy("folder");
    setMsg(null);
    try {
      const { blob, filename } = await buildInvoicePdf(invoice, customer, company);
      const res = await savePdfToFolder(blob, filename, { promptIfMissing: true });
      if (res.ok) {
        setFolderName(res.folder);
        setMsg({ kind: "ok", text: `Saved ${filename} to "${res.folder}".` });
      } else if (res.reason === "cancelled") {
        // user dismissed the folder picker; no message needed
      } else if (res.reason === "denied") {
        setMsg({ kind: "err", text: "Permission to write to that folder was denied." });
      } else if (res.reason === "unsupported") {
        setMsg({ kind: "err", text: "This browser can't save to a folder — use Download instead." });
      } else {
        setMsg({ kind: "err", text: `Could not save: ${res.error ?? "unknown error"}` });
      }
    } catch (e) {
      setMsg({ kind: "err", text: `Could not save: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    setMsg(null);
    try {
      const { blob, filename } = await buildInvoicePdf(invoice, customer, company);
      downloadBlob(blob, filename);
      setMsg({ kind: "ok", text: `PDF downloaded (${filename}).` });
    } catch (e) {
      setMsg({ kind: "err", text: `Could not create PDF: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  async function gmailPdf() {
    setBusy("gmail");
    setMsg(null);
    try {
      const { blob, filename } = await buildInvoicePdf(invoice, customer, company);
      emailViaGmail({ blob, filename, ...buildEmail() });
      setMsg({
        kind: "ok",
        text: `"${filename}" downloaded and Gmail opened — attach that file (paperclip) and send.`,
      });
    } catch (e) {
      setMsg({ kind: "err", text: `Could not open Gmail: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back
        </button>
        <button
          onClick={onEdit}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          {folderSupported && (
            <button
              onClick={saveToFolder}
              disabled={!!busy}
              className="rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-sky-50 disabled:opacity-50"
              title={folderName ? `Saves into "${folderName}"` : "Choose a folder to save invoices into"}
            >
              {busy === "folder" ? "Saving…" : folderName ? `Save to ${folderName}` : "Save to folder…"}
            </button>
          )}
          <button
            onClick={downloadPdf}
            disabled={!!busy}
            className="rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-sky-50 disabled:opacity-50"
          >
            {busy === "pdf" ? "Creating…" : "Download PDF"}
          </button>
          <button
            onClick={gmailPdf}
            disabled={!!busy}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {busy === "gmail" ? "Preparing…" : "Email via Gmail"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-700/10 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Paper preview */}
      <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="h-16 w-16 object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
            <div>
              <h2 className="text-lg font-bold text-slate-800">{company.name}</h2>
              <p className="whitespace-pre-line text-xs text-slate-500">{company.addressLines}</p>
              {company.phone && <p className="text-xs text-slate-500">P: {company.phone}</p>}
              {company.email && <p className="text-xs text-slate-500">E: {company.email}</p>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand">INVOICE</div>
            <div className="mt-1 text-sm text-slate-600">
              <div>
                <span className="text-slate-400">Invoice #: </span>
                {invoice.invoiceNo}
              </div>
              <div>
                <span className="text-slate-400">Date: </span>
                {fmtDate(invoice.date)}
              </div>
            </div>
          </div>
        </div>

        <div className="my-5 border-t-2 border-brand" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-brand">Bill to</div>
            <div className="mt-1 text-sm text-slate-700">
              {customer ? (
                <>
                  <div className="font-medium">{customer.companyName}</div>
                  {customer.contactName && <div>{customer.contactName}</div>}
                  {customer.address && <div>{customer.address}</div>}
                  <div>{[customer.city, customer.state, customer.zip].filter(Boolean).join(" ")}</div>
                  {customer.phone && <div>Phone: {customer.phone}</div>}
                  {customer.email && <div>Email: {customer.email}</div>}
                </>
              ) : (
                <div>{invoice.companyLabel || "—"}</div>
              )}
            </div>
          </div>
          {invoice.projectDescription && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-brand">Invoice for</div>
              <div className="mt-1 text-sm text-slate-700">{invoice.projectDescription}</div>
            </div>
          )}
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="bg-brand text-left text-xs uppercase text-white">
              <th className="px-2 py-2">Item #</th>
              <th className="px-2 py-2">Description</th>
              <th className="px-2 py-2 text-center">Qty</th>
              <th className="px-2 py-2 text-right">Unit price</th>
              <th className="px-2 py-2 text-right">Discount</th>
              <th className="px-2 py-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((it, i) => (
              <tr key={i} className="border-b border-slate-100 odd:bg-slate-50/60">
                <td className="px-2 py-1.5 text-center">{it.itemNo || i + 1}</td>
                <td className="px-2 py-1.5">{it.description}</td>
                <td className="px-2 py-1.5 text-center tabular-nums">{it.qty}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(it.discount)}</td>
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">{fmtMoney(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <PreviewRow label="Subtotal" value={fmtMoney(totals.subtotal)} />
            {invoice.taxRate > 0 && (
              <PreviewRow label={`GST (${round2(invoice.taxRate * 100)}%)`} value={fmtMoney(totals.gst)} />
            )}
            {invoice.other !== 0 && <PreviewRow label="Other" value={fmtMoney(invoice.other)} />}
            {invoice.deposit !== 0 && (
              <PreviewRow label="Deposit received" value={`-${fmtMoney(invoice.deposit)}`} />
            )}
            <div className="mt-1 border-t border-brand pt-1">
              <PreviewRow label={`TOTAL (${currency})`} value={fmtMoney(totals.total)} strong />
            </div>
          </div>
        </div>

        {(company.bankDetails || company.paymentTerms) && (
          <div className="mt-8 border-t border-slate-200 pt-4 text-xs text-slate-500">
            {company.bankDetails && (
              <div className="mb-2">
                <div className="font-bold text-brand">Electronic transfer details</div>
                <div className="whitespace-pre-line">{company.bankDetails}</div>
              </div>
            )}
            {company.paymentTerms && <div className="italic">{company.paymentTerms}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-bold text-brand" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
