# Import/Export Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Import/Export page in `apps/web-v2` — download-based export with format/namespace/locale selection, and a 3-step import dialog (upload → diff preview → confirm).

**Architecture:** Four files: API layer (`shared/api/importExport.ts`), ExportPanel feature component, ImportDialog feature component, and the page that composes them. No React Query cache — all calls are one-shot mutations. Import dialog is self-contained with local step state.

**Tech Stack:** React 19, TanStack React Query 5 (`useMutation`), shadcn/ui (Card, Dialog, Select, Badge, Separator), Tailwind v4, `@hato-tms/shared` types, `useNamespaces()` hook, `apiClient` axios instance.

---

## File Map

| Action | Path |
|---|---|
| Create | `apps/web-v2/src/shared/api/importExport.ts` |
| Create | `apps/web-v2/src/features/export-translations/ui/ExportPanel.tsx` |
| Create | `apps/web-v2/src/features/import-translations/ui/ImportDialog.tsx` |
| Modify | `apps/web-v2/src/pages/import-export/index.tsx` |

---

## Task 1: API Layer

**File:** Create `apps/web-v2/src/shared/api/importExport.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { ImportPreview } from '@hato-tms/shared'
import { apiClient } from './client'

type ImportFormat = 'json' | 'csv'
type ExportFormat = 'json_nested' | 'json_flat' | 'csv'

export interface ImportPayload {
  namespacePath: string
  data: string
  format: ImportFormat
}

export async function previewImport(payload: ImportPayload): Promise<ImportPreview> {
  const { data } = await apiClient.post(`/import-export/import/${payload.format}`, {
    namespacePath: payload.namespacePath,
    data: payload.data,
    confirm: false,
  })
  return data
}

export async function confirmImport(payload: ImportPayload): Promise<{ imported: number }> {
  const { data } = await apiClient.post(`/import-export/import/${payload.format}`, {
    namespacePath: payload.namespacePath,
    data: payload.data,
    confirm: true,
  })
  return data
}

export async function downloadExport(
  format: ExportFormat,
  namespacePaths: string[],
  locales: string[],
): Promise<void> {
  const isCSV = format === 'csv'
  const url = `/import-export/export/${isCSV ? 'csv' : 'json'}`
  const params: Record<string, string> = {
    namespaces: namespacePaths.join(','),
    locales: locales.join(','),
  }
  if (!isCSV) params.format = format

  const response = await apiClient.get(url, { params, responseType: 'blob' })

  const date = new Date().toISOString().split('T')[0]
  const ext = isCSV ? 'csv' : 'json'
  const blobUrl = URL.createObjectURL(new Blob([response.data]))
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `hato-export-${date}.${ext}`
  a.click()
  URL.revokeObjectURL(blobUrl)
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/shared/api/importExport.ts
git commit -m "feat(web-v2): add import/export API layer"
```

---

## Task 2: Export Panel

**File:** Create `apps/web-v2/src/features/export-translations/ui/ExportPanel.tsx`

- [ ] **Step 1: Create the directory and file**

```typescript
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Locale } from '@hato-tms/shared'
import { useNamespaces } from '@/entities/namespace/api/useNamespaces'
import { downloadExport } from '@/shared/api/importExport'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'
import { toast } from 'sonner'

type ExportFormat = 'json_nested' | 'json_flat' | 'csv'

const FORMAT_LABELS: Record<ExportFormat, string> = {
  json_nested: 'JSON Nested',
  json_flat:   'JSON Flat',
  csv:         'CSV',
}

export function ExportPanel() {
  const { data: namespaces } = useNamespaces()

  const [format,     setFormat]     = useState<ExportFormat>('json_nested')
  const [selectedNs, setSelectedNs] = useState<string[]>([])  // empty = all
  const [locales,    setLocales]    = useState<string[]>([Locale.TH, Locale.EN])

  const allNsPaths = (namespaces ?? []).map((ns) => ns.path)

  // selectedNs=[] means all are selected; non-empty means explicit selection
  const effectiveNs = selectedNs.length === 0 ? allNsPaths : selectedNs

  const isNsChecked = (path: string) =>
    selectedNs.length === 0 || selectedNs.includes(path)

  const toggleNs = (path: string) => {
    if (selectedNs.length === 0) {
      // currently all selected — deselect this one
      setSelectedNs(allNsPaths.filter((p) => p !== path))
    } else if (selectedNs.includes(path)) {
      const next = selectedNs.filter((p) => p !== path)
      // if all are now selected, revert to "all" mode
      setSelectedNs(next.length === allNsPaths.length ? [] : next)
    } else {
      const next = [...selectedNs, path]
      setSelectedNs(next.length === allNsPaths.length ? [] : next)
    }
  }

  const toggleLocale = (locale: string) =>
    setLocales((prev) =>
      prev.includes(locale) ? prev.filter((l) => l !== locale) : [...prev, locale],
    )

  const exportMutation = useMutation({
    mutationFn: () => downloadExport(format, effectiveNs, locales),
    onSuccess: () => toast.success('Export downloaded'),
    onError: () => toast.error('Export failed'),
  })

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Export</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* Format */}
        <div className="space-y-2">
          <Label>Format</Label>
          <div className="flex gap-2">
            {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  format === f
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent'
                }`}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Namespaces */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Namespaces</Label>
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setSelectedNs([])}
            >
              Select all
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto rounded-md border border-border p-2 space-y-1">
            {allNsPaths.map((path) => (
              <label
                key={path}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={isNsChecked(path)}
                  onChange={() => toggleNs(path)}
                />
                <span className="font-mono text-xs">{path}</span>
              </label>
            ))}
            {allNsPaths.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No namespaces found.</p>
            )}
          </div>
        </div>

        {/* Locales */}
        <div className="space-y-2">
          <Label>Locales</Label>
          <div className="flex gap-4">
            {[Locale.TH, Locale.EN].map((locale) => (
              <label key={locale} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={locales.includes(locale)}
                  onChange={() => toggleLocale(locale)}
                />
                <span className="text-sm font-medium uppercase">{locale}</span>
              </label>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || locales.length === 0 || effectiveNs.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {exportMutation.isPending ? 'Downloading...' : 'Download'}
        </Button>

      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/features/export-translations/ui/ExportPanel.tsx
git commit -m "feat(web-v2): add ExportPanel feature component"
```

---

## Task 3: Import Dialog

**File:** Create `apps/web-v2/src/features/import-translations/ui/ImportDialog.tsx`

Key notes:
- File format detected from filename: `.csv` → `'csv'`, anything else → `'json'`
- `Locale.TH = "th"`, `Locale.EN = "en"` — display uppercased
- `ImportPreview` shape: `{ added: {key,th,en}[], modified: {key,locale,oldValue,newValue}[], removed: {key,th,en}[] }`
- `previewImport` and `confirmImport` imported from `@/shared/api/importExport`

- [ ] **Step 1: Create the directory and file**

```typescript
import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Upload, ChevronDown, ChevronRight } from 'lucide-react'
import { type ImportPreview } from '@hato-tms/shared'
import { useNamespaces } from '@/entities/namespace/api/useNamespaces'
import { previewImport, confirmImport } from '@/shared/api/importExport'
import { Button } from '@/shared/ui/button'
import { Label } from '@/shared/ui/label'
import { Separator } from '@/shared/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/ui/select'
import { toast } from 'sonner'

type ImportStep = 'upload' | 'preview' | 'done'

interface Props {
  open: boolean
  onClose: () => void
}

function DiffSection({
  title,
  count,
  variant,
  expanded,
  onToggle,
  children,
}: {
  title: string
  count: number
  variant: 'added' | 'modified' | 'removed'
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const cls = {
    added:    'border-green-200  bg-green-50   text-green-700  dark:border-green-800  dark:bg-green-950/30  dark:text-green-400',
    modified: 'border-yellow-200 bg-yellow-50  text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400',
    removed:  'border-red-200    bg-red-50     text-red-700    dark:border-red-800    dark:bg-red-950/30    dark:text-red-400',
  }[variant]

  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={onToggle}
      >
        <span className="text-sm font-medium">{title} ({count})</span>
        {expanded
          ? <ChevronDown className="h-4 w-4" />
          : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && count > 0 && <div className="mt-2">{children}</div>}
    </div>
  )
}

export function ImportDialog({ open, onClose }: Props) {
  const { data: namespaces } = useNamespaces()

  const [step,          setStep]          = useState<ImportStep>('upload')
  const [namespacePath, setNamespacePath] = useState('')
  const [file,          setFile]          = useState<File | null>(null)
  const [fileContent,   setFileContent]   = useState('')
  const [preview,       setPreview]       = useState<ImportPreview | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [expanded,      setExpanded]      = useState<Set<string>>(
    new Set(['added', 'modified', 'removed']),
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  const format = file?.name.endsWith('.csv') ? 'csv' : 'json'

  const resetForm = () => {
    setStep('upload')
    setNamespacePath('')
    setFile(null)
    setFileContent('')
    setPreview(null)
    setImportedCount(0)
    setExpanded(new Set(['added', 'modified', 'removed']))
  }

  const handleClose = () => { resetForm(); onClose() }

  const handleFileSelect = (f: File) => {
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => setFileContent((e.target?.result as string) ?? '')
    reader.readAsText(f)
  }

  const toggleSection = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const previewMutation = useMutation({
    mutationFn: () => previewImport({ namespacePath, data: fileContent, format }),
    onSuccess: (data) => { setPreview(data); setStep('preview') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Preview failed'
      toast.error(msg)
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => confirmImport({ namespacePath, data: fileContent, format }),
    onSuccess: (data) => { setImportedCount(data.imported); setStep('done') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Import failed'
      toast.error(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Translations</DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Namespace</Label>
              <Select value={namespacePath} onValueChange={setNamespacePath}>
                <SelectTrigger>
                  <SelectValue placeholder="Select namespace…" />
                </SelectTrigger>
                <SelectContent>
                  {(namespaces ?? []).map((ns) => (
                    <SelectItem key={ns.id} value={ns.path}>{ns.path}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>File</Label>
              <div
                className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border p-8 transition-colors hover:border-primary hover:bg-accent/30"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f) handleFileSelect(f)
                }}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Drop file here or click to browse</p>
                    <p className="mt-1 text-xs text-muted-foreground">.json or .csv</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={!namespacePath || !file || !fileContent || previewMutation.isPending}
              >
                {previewMutation.isPending ? 'Previewing…' : 'Preview Changes'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Diff Preview ── */}
        {step === 'preview' && preview && (
          <div className="space-y-3 mt-2">
            <DiffSection
              title="Added"
              count={preview.added.length}
              variant="added"
              expanded={expanded.has('added')}
              onToggle={() => toggleSection('added')}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-current/20">
                    <th className="pb-1 text-left font-medium">Key</th>
                    <th className="pb-1 text-left font-medium">TH</th>
                    <th className="pb-1 text-left font-medium">EN</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.added.map((item, i) => (
                    <tr key={i} className="border-b border-current/10">
                      <td className="py-1 font-mono">{item.key}</td>
                      <td className="py-1 opacity-80">{item.th}</td>
                      <td className="py-1 opacity-80">{item.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DiffSection>

            <DiffSection
              title="Modified"
              count={preview.modified.length}
              variant="modified"
              expanded={expanded.has('modified')}
              onToggle={() => toggleSection('modified')}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-current/20">
                    <th className="pb-1 text-left font-medium">Key</th>
                    <th className="pb-1 text-left font-medium">Locale</th>
                    <th className="pb-1 text-left font-medium">Before</th>
                    <th className="pb-1 text-left font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.modified.map((item, i) => (
                    <tr key={i} className="border-b border-current/10">
                      <td className="py-1 font-mono">{item.key}</td>
                      <td className="py-1 uppercase">{item.locale}</td>
                      <td className="py-1 line-through opacity-60">{item.oldValue}</td>
                      <td className="py-1 text-green-600 dark:text-green-400">{item.newValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DiffSection>

            <DiffSection
              title="Removed (warning only — not deleted)"
              count={preview.removed.length}
              variant="removed"
              expanded={expanded.has('removed')}
              onToggle={() => toggleSection('removed')}
            >
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-current/20">
                    <th className="pb-1 text-left font-medium">Key</th>
                    <th className="pb-1 text-left font-medium">TH</th>
                    <th className="pb-1 text-left font-medium">EN</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.removed.map((item, i) => (
                    <tr key={i} className="border-b border-current/10">
                      <td className="py-1 font-mono">{item.key}</td>
                      <td className="py-1 opacity-80">{item.th}</td>
                      <td className="py-1 opacity-80">{item.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DiffSection>

            <Separator />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending}
              >
                {confirmMutation.isPending ? 'Importing…' : 'Confirm Import'}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl text-primary">
              ✓
            </div>
            <div>
              <p className="font-medium">Import complete</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {importedCount} key{importedCount !== 1 ? 's' : ''} created or updated
              </p>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/features/import-translations/ui/ImportDialog.tsx
git commit -m "feat(web-v2): add ImportDialog feature component"
```

---

## Task 4: Import/Export Page

**File:** Modify `apps/web-v2/src/pages/import-export/index.tsx`

Replace the placeholder entirely.

- [ ] **Step 1: Rewrite the file**

```typescript
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { ExportPanel } from '@/features/export-translations/ui/ExportPanel'
import { ImportDialog } from '@/features/import-translations/ui/ImportDialog'
import { Button } from '@/shared/ui/button'

export function ImportExportPage() {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Import / Export</h1>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />Import
        </Button>
      </div>

      <div className="p-6">
        <ExportPanel />
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/pages/import-export/index.tsx
git commit -m "feat(web-v2): implement import/export page"
```

---

## Task 5: Final Verification

- [ ] **Step 1: Full type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: zero errors across all new files.

- [ ] **Step 2: Verify dev server starts**

```bash
npm -w @hato-tms/web-v2 run dev
```

Expected: Vite starts on port 3001 with no compile errors.

- [ ] **Step 3: Final commit if any fixes were made**

```bash
git add -A
git commit -m "feat(web-v2): complete Step 6 – Import/Export feature"
```
