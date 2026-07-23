# MPH Invoices (PWA)

An offline-first Progressive Web App for creating, storing, and emailing
**MPH Consulting** invoices. Works on desktop and phone, installs to the home
screen, needs **no backend** — data lives in the browser (IndexedDB) and syncs
between devices through a private GitHub Gist.

The full invoice history (2019 onwards) was migrated from the master Excel
workbook `MPH Invoices - PWA.xlsx` with exact numeric fidelity.

## Features

- Full searchable invoice history migrated from Excel (89 invoices, 100 line items)
- Create / edit invoices with a client picker (and inline "add client")
- Live-calculating line items, GST, other charges and deposits
- One-click **PDF** generation with the MPH Consulting logo
- **Email** an invoice: on phone via the native share sheet to Gmail; on desktop
  it downloads the PDF and opens a pre-filled Gmail compose window
- Client directory (add / edit / delete)
- Editable business details + bank / electronic-transfer details
- Automatic cloud sync across devices via a private GitHub Gist
- Manual JSON backup / restore

## Stack

- **Vite + React + TypeScript**
- **Tailwind CSS**
- **IndexedDB** (via `idb`) for offline storage
- **jsPDF** + **jspdf-autotable** for PDF invoices
- **vite-plugin-pwa** for installability + offline caching

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # preview the production build
```

## Data pipeline

Scripts live in `migration/` and `scripts/`:

| Script | Purpose |
| --- | --- |
| `migration/migrate.py` | Extract customers, invoices and line items from the Excel workbook into `migration/invoices-full.json` (private, gitignored). Prefers an exact client-name match (the source has a few mis-numbered rows) and reconciles every invoice's line sum against the sheet's own detail total. |
| `scripts/build_gist_body.py` | Build a cloud-sync backup bundle from `invoices-full.json` for seeding the private sync Gist. |
| `scripts/make_icons.py` | Generate `public/logo.png` and the PWA icon set from the MPH Consulting logo. |

Regenerate the private dataset after editing the workbook:

```bash
npm run seed
```

### Privacy: history is not bundled

The public app ships with an **empty** `src/data/invoices-data.json` (company
profile only). The real invoice history is **never committed or published** — it
lives only in your private cloud-sync Gist and in each device's local IndexedDB.
On a fresh device, open **Settings → Automatic cloud sync**, connect your token,
and your history is pulled in.

## Cloud sync

Settings → *Automatic cloud sync*: paste a GitHub personal-access token with the
**gist** scope (fine-grained: *Gists → Read and write*). Use the **same token**
on every device. The same token as the Pilot Logbook works here — this app keeps
its own separate backup file (`invoices-backup.json`).

## Deploy

`npm run build` produces `dist/`, deployable to GitHub Pages (the app uses a
relative base so it works from a subpath). Installable on phone and desktop.
