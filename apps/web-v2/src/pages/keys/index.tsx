import { useState, useMemo, useCallback, useRef } from 'react'
import { Plus, Search, RefreshCw, Trash2, X } from 'lucide-react'
import { Platform, type TranslationKeyDTO, type SearchParams } from '@hato-tms/shared'
import { useKeys, useDeleteKey } from '@/entities/translation-key/api/useKeys'
import { useNamespaces } from '@/entities/namespace/api/useNamespaces'
import { useTranslation } from '@/shared/lib/useTranslation'
import { CreateKeyDialog } from '@/features/create-key/ui/CreateKeyDialog'
import { CreateCRDialog } from '@/features/create-change-request/ui/CreateCRDialog'
import { KeyDetailSheet } from '@/widgets/key-detail'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { cn } from '@/shared/lib/utils'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  translated: 'default',
  TRANSLATED: 'default',
  pending:    'secondary',
  PENDING:    'secondary',
  in_review:  'outline',
  IN_REVIEW:  'outline',
}

export function KeysPage() {
  const { t } = useTranslation()
  const qc    = useDeleteKey()

  // Filters
  const [searchQuery,     setSearchQuery]     = useState('')
  const [debouncedQuery,  setDebouncedQuery]  = useState('')
  const [nsFilter,        setNsFilter]        = useState<string | undefined>()
  const [statusFilter,    setStatusFilter]    = useState<string | undefined>()
  const [platformFilter,  setPlatformFilter]  = useState<string | undefined>()
  const [page,            setPage]            = useState(1)
  const [pageSize]                            = useState(20)

  // UI state
  const [createOpen,    setCreateOpen]    = useState(false)
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null)
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [createCROpen,  setCreateCROpen]  = useState(false)
  const [keysForCR,     setKeysForCR]     = useState<TranslationKeyDTO[]>([])

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedQuery(val); setPage(1) }, 300)
  }, [])

  const params: SearchParams = useMemo(() => ({
    query:     debouncedQuery || undefined,
    namespace: nsFilter,
    status:    statusFilter as SearchParams['status'],
    platform:  platformFilter as SearchParams['platform'],
    page,
    pageSize,
    sortBy:    'updated',
    sortOrder: 'desc',
  }), [debouncedQuery, nsFilter, statusFilter, platformFilter, page, pageSize])

  const { data: keysRes, isLoading, isError, refetch } = useKeys(params)
  const { data: namespaces } = useNamespaces()

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === (keysRes?.data.length ?? 0)) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(keysRes?.data.map((k) => k.id) ?? []))
    }
  }

  const handleBulkDelete = () => {
    const ids = [...selectedIds]
    Promise.all(ids.map((id) => qc.mutateAsync(id)))
      .then(() => {
        toast.success(t('success.keysDeleted', { count: ids.length }))
        setSelectedIds(new Set())
      })
      .catch(() => toast.error(t('error.deleteFailed')))
  }

  const handleRowClick = (key: TranslationKeyDTO) => {
    setSelectedKeyId(key.id)
    setSheetOpen(true)
  }

  const totalPages = keysRes ? Math.ceil(keysRes.total / pageSize) : 0
  const hasFilters = !!(debouncedQuery || nsFilter || statusFilter || platformFilter)
  const isEmpty    = !isLoading && (keysRes?.total ?? 0) === 0

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="font-medium text-destructive">{t('error.loadKeys')}</p>
        <p className="text-sm text-muted-foreground">{t('error.loadKeysDesc')}</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />{t('common.retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">{t('page.title')}</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />{t('cta.newKey')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-72 pl-8"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <Select value={nsFilter} onValueChange={(v) => { setNsFilter(v || undefined); setPage(1) }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filter.namespace')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('common.all')}</SelectItem>
            {(namespaces ?? []).map((ns) => (
              <SelectItem key={ns.id} value={ns.path}>{ns.path}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v || undefined); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('filter.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('common.all')}</SelectItem>
            <SelectItem value="TRANSLATED">TRANSLATED</SelectItem>
            <SelectItem value="PENDING">PENDING</SelectItem>
            <SelectItem value="IN_REVIEW">IN REVIEW</SelectItem>
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={(v) => { setPlatformFilter(v || undefined); setPage(1) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('filter.platform')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('common.all')}</SelectItem>
            {Object.values(Platform).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearchQuery(''); setDebouncedQuery(''); setNsFilter(undefined)
            setStatusFilter(undefined); setPlatformFilter(undefined); setPage(1)
          }}>
            <X className="mr-1 h-3.5 w-3.5" />{t('common.clear')}
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {keysRes ? t('keys.total', { count: keysRes.total }) : ''}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground">
              {hasFilters ? t('keys.noMatch') : t('empty.noKeys')}
            </p>
            {!hasFilters && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />{t('cta.newKey')}
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={selectedIds.size > 0 && selectedIds.size === (keysRes?.data.length ?? 0)}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[28%]">{t('col.key')}</TableHead>
                <TableHead className="w-[22%]">{t('col.th')}</TableHead>
                <TableHead className="w-[22%]">{t('col.en')}</TableHead>
                <TableHead className="w-28">{t('col.status')}</TableHead>
                <TableHead>{t('col.tags')}</TableHead>
                <TableHead className="w-32 text-right">{t('col.lastUpdated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(keysRes?.data ?? []).map((key) => {
                const th = key.values.find((v) => v.locale.toUpperCase() === 'TH')
                const en = key.values.find((v) => v.locale.toUpperCase() === 'EN')
                return (
                  <TableRow
                    key={key.id}
                    className={cn('cursor-pointer', selectedIds.has(key.id) && 'bg-accent/40')}
                    onClick={() => handleRowClick(key)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={selectedIds.has(key.id)}
                        onChange={() => toggleSelect(key.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                        {key.fullKey}
                      </code>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {th?.value || <span className="text-xs text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                      {en?.value || <span className="text-xs text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[key.status] ?? 'secondary'} className="text-xs">
                        {key.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                        {key.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{key.tags.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {dayjs(key.updatedAt).format('MMM D, YYYY')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-primary px-6 py-3 shadow-xl">
          <span className="text-sm font-medium text-primary-foreground">
            {t('keys.keysSelected', { count: selectedIds.size })}
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={qc.isPending}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('common.delete')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const selected = (keysRes?.data ?? []).filter((k) => selectedIds.has(k.id))
              setKeysForCR(selected)
              setCreateCROpen(true)
            }}
          >
            Create CR
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            <X className="mr-1 h-3.5 w-3.5" />{t('common.clear')}
          </Button>
        </div>
      )}

      <CreateKeyDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CreateCRDialog
        open={createCROpen}
        onClose={() => { setCreateCROpen(false); setKeysForCR([]) }}
        preselectedKeys={keysForCR}
      />
      <KeyDetailSheet
        keyId={selectedKeyId}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedKeyId(null) }}
      />
    </div>
  )
}
