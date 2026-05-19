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
