import { clearPdfDir, getPdfDir, putPdfDir } from "./db";

/** Whether this browser supports saving straight to a chosen folder. */
export function isFolderSaveSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** Name of the currently remembered folder, or null if none is set. */
export async function getFolderName(): Promise<string | null> {
  const h = await getPdfDir();
  return h?.name ?? null;
}

/** Prompt the user to choose (and remember) a folder. Returns its name or null if cancelled. */
export async function chooseFolder(): Promise<string | null> {
  if (!window.showDirectoryPicker) return null;
  try {
    const handle = await window.showDirectoryPicker({
      id: "mph-invoices-pdfs",
      mode: "readwrite",
      startIn: "documents",
    });
    await putPdfDir(handle);
    return handle.name;
  } catch (e) {
    if ((e as Error).name === "AbortError") return null;
    throw e;
  }
}

export async function forgetFolder(): Promise<void> {
  await clearPdfDir();
}

async function ensurePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const opts: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  return (await handle.requestPermission(opts)) === "granted";
}

export type SaveToFolderResult =
  | { ok: true; folder: string }
  | { ok: false; reason: "unsupported" | "no-folder" | "cancelled" | "denied" | "error"; error?: string };

/**
 * Save a blob into the remembered folder. If no folder is remembered and
 * `promptIfMissing` is set, ask the user to pick one (and remember it) first.
 */
export async function savePdfToFolder(
  blob: Blob,
  filename: string,
  opts?: { promptIfMissing?: boolean },
): Promise<SaveToFolderResult> {
  if (!window.showDirectoryPicker) return { ok: false, reason: "unsupported" };
  let handle = await getPdfDir();
  if (!handle) {
    if (!opts?.promptIfMissing) return { ok: false, reason: "no-folder" };
    try {
      handle = await window.showDirectoryPicker({
        id: "mph-invoices-pdfs",
        mode: "readwrite",
        startIn: "documents",
      });
      await putPdfDir(handle);
    } catch (e) {
      if ((e as Error).name === "AbortError") return { ok: false, reason: "cancelled" };
      return { ok: false, reason: "error", error: (e as Error).message };
    }
  }
  try {
    if (!(await ensurePermission(handle))) return { ok: false, reason: "denied" };
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { ok: true, folder: handle.name };
  } catch (e) {
    return { ok: false, reason: "error", error: (e as Error).message };
  }
}
