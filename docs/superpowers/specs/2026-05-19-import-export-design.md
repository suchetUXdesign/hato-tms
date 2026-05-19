# Design: Step 6 — Import/Export Feature (web-v2)

**Date:** 2026-05-19  
**Status:** Approved

---

## Summary

Implement the Import/Export feature in `apps/web-v2`. The backend (`apps/api`) has full import/export support — this is a pure frontend build. Import is infrequent (initial setup), so it lives behind a dialog. Export is the primary use case and is surfaced directly on the page.

GitHub PR integration is intentionally out of scope — deferred to a future step.

---

## Architecture

Four new units in `apps/web-v2/src/`:

| Unit | Path | Purpose |
|---|---|---|
| API layer | `shared/api/importExport.ts` | Axios calls + blob download helper |
| Import dialog | `features/import-translations/ui/ImportDialog.tsx` | 3-step dialog: upload → diff → success |
| Export panel | `features/export-translations/ui/ExportPanel.tsx` | Format + namespace + locale selectors + download |
| Page | `pages/import-export/index.tsx` | Replaces placeholder, composes both features |

No React Query hooks — all calls are one-shot mutations (`useMutation`) called directly from feature components.

---

## UI Flows

### Page Layout (`/import-export`)

Two cards:
- **Export card** (primary, top/left) — format + namespace + locale selectors, Download button
- **Import card** (secondary, bottom/right) — single "Import file…" button that opens ImportDialog

### Export Card

- **Format:** Radio group — `JSON Nested` | `JSON Flat` | `CSV`
- **Namespaces:** Multi-select dropdown, all namespaces listed, all selected by default
- **Locales:** Two checkboxes — TH / EN, both checked by default
- **Download button:** Triggers blob download. Filename: `hato-export-YYYY-MM-DD.{json|csv}`
- Loading state on button while downloading

### ImportDialog (3 steps)

**Step 1 — Upload**
- Namespace selector (required, dropdown from `GET /namespaces`)
- File drop zone: accepts `.json` and `.csv`, shows filename when file is selected
- "Preview Changes" button (disabled until namespace + file both selected)
- Calls `POST /import-export/import/{json|csv}` with `confirm: false` to get `ImportPreview`

**Step 2 — Diff Preview**
- Three collapsible sections:
  - **Added** (green badge with count): table of `key | TH | EN`
  - **Modified** (yellow badge with count): table of `key | locale | old value (strikethrough) | new value`
  - **Removed** (red badge with count): warning only — keys listed, not deleted
- Back button (returns to Step 1) + "Confirm Import" button
- Confirm calls `POST /import-export/import/{json|csv}` with `confirm: true`

**Step 3 — Done**
- Success message: "Import complete — N added, N modified"
- "Close" button (resets dialog to Step 1 for next import)

---

## API Calls

```
// Import (preview)
POST /api/v1/import-export/import/json
POST /api/v1/import-export/import/csv
Body: { namespacePath, data: string, confirm: false }
Returns: ImportPreview { added[], modified[], removed[] }

// Import (confirm)
POST /api/v1/import-export/import/json
POST /api/v1/import-export/import/csv
Body: { namespacePath, data: string, confirm: true }
Returns: { imported: number }

// Export
GET /api/v1/import-export/export/json?namespaces=&locales=&format=
GET /api/v1/import-export/export/csv?namespaces=&locales=
Returns: blob (file download)
```

---

## Data & Types

From `@hato-tms/shared` — no new types needed:
- `ImportPreview` — `{ added: {key,th,en}[], modified: {key,locale,oldValue,newValue}[], removed: {key,th,en}[] }`
- `ExportOptions` — `{ format: 'json_nested'|'json_flat'|'csv', namespacePaths: string[], locales?: Locale[] }`

Local only:
- `ImportStep = 'upload' | 'preview' | 'done'` — dialog step state
- File type detection: if filename ends `.csv` → use csv endpoint; otherwise json

---

## Self-Review

- No TBDs or placeholders
- Architecture is frontend-only, backend is complete
- Import dialog is scoped to one dialog component (no splitting needed — state flows linearly through 3 steps)
- Export panel is stateless enough to be a single focused component
- GitHub PR integration explicitly excluded
- File type detection is unambiguous (csv vs everything else = json)
