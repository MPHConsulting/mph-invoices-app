import { useEffect, useRef, useState } from "react";
import type { CompanyProfile } from "../types";
import { exportData, importData, type BackupBundle } from "../lib/db";
import { fmtDateTime } from "../lib/format";
import { chooseFolder, forgetFolder, getFolderName, isFolderSaveSupported } from "../lib/fsAccess";
import {
  backupToGist,
  connect as gistConnect,
  disconnect,
  getGistStatus,
  restoreFromGist,
  type GistStatus,
} from "../lib/gistBackup";

interface Props {
  profile: CompanyProfile;
  onSaveProfile: (p: CompanyProfile) => void;
  onRestored: () => void;
}

export function SettingsPage({ profile, onSaveProfile, onRestored }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<CompanyProfile>(profile);
  const [savedFlash, setSavedFlash] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [gist, setGist] = useState<GistStatus>(() => getGistStatus());
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const folderSupported = isFolderSaveSupported();
  const [folderName, setFolderName] = useState<string | null>(null);

  useEffect(() => {
    if (folderSupported) getFolderName().then(setFolderName);
  }, [folderSupported]);

  async function pickFolder() {
    try {
      const name = await chooseFolder();
      if (name) {
        setFolderName(name);
        setMsg({ kind: "ok", text: `Invoices will save to "${name}".` });
      }
    } catch (e) {
      setMsg({ kind: "err", text: `Could not set folder: ${(e as Error).message}` });
    }
  }

  async function clearFolder() {
    await forgetFolder();
    setFolderName(null);
    setMsg({ kind: "ok", text: "Save folder cleared." });
  }

  function saveProfile() {
    onSaveProfile(form);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  async function connect() {
    if (!token.trim()) return;
    setBusy(true);
    try {
      setGist(await gistConnect(token));
      setToken("");
      setMsg({ kind: "ok", text: "Cloud sync connected — this device is now in sync." });
      onRestored();
    } catch (e) {
      setGist(getGistStatus());
      setMsg({ kind: "err", text: `Could not connect: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function backupNow() {
    setBusy(true);
    try {
      setGist(await backupToGist());
      setMsg({ kind: "ok", text: "Backed up to cloud." });
    } catch (e) {
      setMsg({ kind: "err", text: `Cloud backup failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function cloudRestore() {
    if (!confirm("Restore will REPLACE all data on this device with the latest cloud backup. Continue?"))
      return;
    setBusy(true);
    try {
      const n = await restoreFromGist();
      setMsg({ kind: "ok", text: `Restored ${n} records from the cloud backup.` });
      onRestored();
    } catch (e) {
      setMsg({ kind: "err", text: `Cloud restore failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  function cloudDisconnect() {
    disconnect();
    setGist(getGistStatus());
    setMsg({ kind: "ok", text: "Cloud sync disconnected on this device." });
  }

  async function download() {
    try {
      const bundle = await exportData();
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mph-invoices-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ kind: "ok", text: `Backup downloaded (${bundle.invoices.length} invoices).` });
    } catch (e) {
      setMsg({ kind: "err", text: `Backup failed: ${(e as Error).message}` });
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Restore will REPLACE all data on this device with the backup file. Continue?"))
      return;
    try {
      const bundle = JSON.parse(await file.text()) as BackupBundle;
      await importData(bundle);
      setMsg({ kind: "ok", text: `Restored ${bundle.invoices?.length ?? 0} invoices from ${file.name}.` });
      onRestored();
    } catch (err) {
      setMsg({ kind: "err", text: `Restore failed: ${(err as Error).message}` });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {msg && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            msg.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Company profile */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Your business details</h2>
        <p className="mt-1 text-sm text-slate-500">
          These appear in the header and footer of every invoice PDF.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <TextField label="Business name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <TextField label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          <TextArea label="Address" value={form.addressLines} onChange={(v) => setForm({ ...form, addressLines: v })} className="sm:col-span-2" />
          <TextField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <TextField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <TextArea label="Electronic transfer / bank details" value={form.bankDetails} onChange={(v) => setForm({ ...form, bankDetails: v })} className="sm:col-span-2" />
          <TextArea label="Payment terms" value={form.paymentTerms} onChange={(v) => setForm({ ...form, paymentTerms: v })} className="sm:col-span-2" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveProfile} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Save details
          </button>
          {savedFlash && <span className="text-sm text-emerald-600">Saved.</span>}
        </div>
      </section>

      {/* PDF save folder */}
      {folderSupported && (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">PDF save folder</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a folder once, and the <span className="font-medium">Save to folder</span> button
            on each invoice will save the PDF straight there — no download prompts. (Desktop
            Chrome/Edge only.)
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">
              Current folder:{" "}
              <span className="font-medium">{folderName ? `"${folderName}"` : "not set"}</span>
            </span>
            <button onClick={pickFolder} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
              {folderName ? "Change folder" : "Choose folder…"}
            </button>
            {folderName && (
              <button onClick={clearFolder} className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                Clear
              </button>
            )}
          </div>
        </section>
      )}

      {/* Cloud sync */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Automatic cloud sync</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              gist.connected ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {gist.connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Keeps your computer and phone in sync through a{" "}
          <span className="font-medium">private GitHub Gist</span>: it pushes after every change and
          pulls the latest when the app opens. Use the <span className="font-medium">same token</span>{" "}
          on each device. The same token as your Pilot Logbook works here (it keeps a separate backup
          file). Best used one device at a time (last save wins).
        </p>

        {gist.connected ? (
          <div className="mt-3 space-y-3">
            <div className="text-sm text-slate-600">
              Last backup: <span className="font-medium">{fmtDateTime(gist.lastAt)}</span>
              {gist.gistId && (
                <>
                  {" · "}
                  <a href={`https://gist.github.com/${gist.gistId}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                    view gist
                  </a>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={backupNow} disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                Back up now
              </button>
              <button onClick={cloudRestore} disabled={busy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Restore from cloud
              </button>
              <button onClick={cloudDisconnect} disabled={busy} className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              <li>
                On GitHub, open{" "}
                <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  Settings → Developer settings → Personal access tokens
                </a>
                .
              </li>
              <li>
                Create a token with <span className="font-medium">Gists: Read and write</span>{" "}
                (fine-grained) or the <span className="font-medium">gist</span> scope (classic).
              </li>
              <li>Paste it below and press Connect.</li>
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste GitHub token"
                autoComplete="off"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button onClick={connect} disabled={busy || !token.trim()} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
                Connect
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Manual backup / restore */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Manual backup &amp; restore</h2>
        <p className="mt-1 text-sm text-slate-500">
          Save a full snapshot (all invoices, clients and settings) to a JSON file, or restore one.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={download} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Download backup
          </button>
          <button onClick={() => fileRef.current?.click()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Restore from file…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
        </div>
      </section>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
    </label>
  );
}

function TextArea({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
    </label>
  );
}
