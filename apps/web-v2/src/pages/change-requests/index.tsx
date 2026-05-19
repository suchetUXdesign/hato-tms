import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { CRStatus, type ChangeRequestDTO } from '@hato-tms/shared'
import { useChangeRequests } from '@/entities/change-request/api/useChangeRequests'
import { CreateCRDialog } from '@/features/create-change-request/ui/CreateCRDialog'
import { CRDetailSheet } from '@/widgets/cr-detail'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import dayjs from 'dayjs'

const STATUS_TABS = [
  { label: 'All',       value: undefined           },
  { label: 'Pending',   value: CRStatus.PENDING    },
  { label: 'Approved',  value: CRStatus.APPROVED   },
  { label: 'Rejected',  value: CRStatus.REJECTED   },
  { label: 'Published', value: CRStatus.PUBLISHED  },
] as const

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  [CRStatus.PENDING]:   'secondary',
  [CRStatus.APPROVED]:  'default',
  [CRStatus.REJECTED]:  'destructive',
  [CRStatus.PUBLISHED]: 'outline',
  [CRStatus.DRAFT]:     'secondary',
}

export function ChangeRequestsPage() {
  const [activeStatus, setActiveStatus] = useState<CRStatus | undefined>(undefined)
  const [createOpen,   setCreateOpen]   = useState(false)
  const [selectedCRId, setSelectedCRId] = useState<string | null>(null)
  const [sheetOpen,    setSheetOpen]    = useState(false)

  const { data, isLoading, isError, refetch } = useChangeRequests(activeStatus)

  const handleRowClick = (cr: ChangeRequestDTO) => {
    setSelectedCRId(cr.id)
    setSheetOpen(true)
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
        <p className="font-medium text-destructive">Failed to load change requests</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Change Requests</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />New CR
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border px-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => setActiveStatus(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeStatus === tab.value
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
            <p className="text-muted-foreground">No change requests found.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />New CR
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="w-20 text-center">Items</TableHead>
                <TableHead className="w-24 text-center">Reviewers</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((cr) => (
                <TableRow
                  key={cr.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(cr)}
                >
                  <TableCell className="font-medium">{cr.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cr.authorName}</TableCell>
                  <TableCell className="text-center text-sm">{cr.items.length}</TableCell>
                  <TableCell className="text-center text-sm">{cr.reviewerIds.length}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[cr.status] ?? 'secondary'} className="text-xs">
                      {cr.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {dayjs(cr.createdAt).format('MMM D, YYYY')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateCRDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CRDetailSheet
        crId={selectedCRId}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedCRId(null) }}
      />
    </div>
  )
}
