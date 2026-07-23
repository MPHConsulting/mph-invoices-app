export interface ShareInvoiceArgs {
  blob: Blob;
  filename: string;
  to: string;
  subject: string;
  body: string;
}

export type ShareResult =
  | { method: "share"; ok: true }
  | { method: "gmail"; ok: true }
  | { method: "cancelled"; ok: false };

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Open a pre-filled Gmail compose window (recipient / subject / body). */
export function openGmailCompose({ to, subject, body }: Omit<ShareInvoiceArgs, "blob" | "filename">) {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  window.open(`https://mail.google.com/mail/?${params.toString()}`, "_blank", "noopener");
}

/**
 * Share an invoice PDF by email.
 *
 * On phones (and Chromium desktop that supports file sharing) this opens the
 * native share sheet with the PDF attached, so the user can pick Gmail. Where
 * file sharing isn't available it downloads the PDF and opens a pre-filled
 * Gmail compose window for the user to attach the just-downloaded file.
 */
export async function shareInvoice(args: ShareInvoiceArgs): Promise<ShareResult> {
  const { blob, filename, to, subject, body } = args;
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
  };

  if (typeof navigator.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: subject, text: body });
      return { method: "share", ok: true };
    } catch (e) {
      // AbortError means the user dismissed the share sheet.
      if ((e as Error).name === "AbortError") return { method: "cancelled", ok: false };
      // Otherwise fall through to the Gmail fallback.
    }
  }

  downloadBlob(blob, filename);
  openGmailCompose({ to, subject, body });
  return { method: "gmail", ok: true };
}
