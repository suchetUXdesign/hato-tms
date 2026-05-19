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
  const effectiveNs = selectedNs.length === 0 ? allNsPaths : selectedNs

  const isNsChecked = (path: string) =>
    selectedNs.length === 0 || selectedNs.includes(path)

  const toggleNs = (path: string) => {
    if (selectedNs.length === 0) {
      setSelectedNs(allNsPaths.filter((p) => p !== path))
    } else if (selectedNs.includes(path)) {
      const next = selectedNs.filter((p) => p !== path)
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
