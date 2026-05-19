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

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Namespace</Label>
              <Select value={namespacePath} onValueChange={(v) => setNamespacePath(v ?? '')}>
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

        {/* Step 2: Diff Preview */}
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

        {/* Step 3: Done */}
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
