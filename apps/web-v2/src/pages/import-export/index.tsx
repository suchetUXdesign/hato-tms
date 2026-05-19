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
