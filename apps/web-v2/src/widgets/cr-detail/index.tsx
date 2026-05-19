import { CRStatus } from '@hato-tms/shared'
import { useAuth } from '@/app/providers/AuthProvider'
import {
  useChangeRequest,
  useReviewChangeRequest,
  usePublishChangeRequest,
  useUsers,
} from '@/entities/change-request/api/useChangeRequests'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import { Separator } from '@/shared/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
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
import { useState } from 'react'

const statusVariant: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  [CRStatus.PENDING]:   'secondary',
  [CRStatus.APPROVED]:  'default',
  [CRStatus.REJECTED]:  'destructive',
  [CRStatus.PUBLISHED]: 'outline',
  [CRStatus.DRAFT]:     'secondary',
}

interface Props {
  crId: string | null
  open: boolean
  onClose: () => void
}

export function CRDetailSheet({ crId, open, onClose }: Props) {
  const { user } = useAuth()
  const { data: cr, isLoading } = useChangeRequest(crId)
  const { data: users }         = useUsers()
  const reviewMutation  = useReviewChangeRequest(crId ?? '')
  const publishMutation = usePublishChangeRequest(crId ?? '')

  const [activeTab, setActiveTab] = useState<'items' | 'reviewers'>('items')

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))

  const canReview = cr && user &&
    cr.status === CRStatus.PENDING &&
    cr.reviewerIds.includes(user.uid) &&
    cr.authorId !== user.uid

  const canPublish = cr && cr.status === CRStatus.APPROVED

  const handleReview = (action: 'approve' | 'reject') => {
    if (!crId) return
    reviewMutation.mutate(
      { action },
      {
        onSuccess: () => toast.success(action === 'approve' ? 'Approved' : 'Rejected'),
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? 'Review failed'
          toast.error(msg)
        },
      },
    )
  }

  const handlePublish = () => {
    if (!crId) return
    publishMutation.mutate(undefined, {
      onSuccess: () => { toast.success('Published — translation values updated'); onClose() },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ?? 'Publish failed'
        toast.error(msg)
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader className="mb-4">
          {isLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : (
            <SheetTitle className="text-base">{cr?.title ?? 'Change Request'}</SheetTitle>
          )}

          {cr && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-sm text-muted-foreground">
              <Badge variant={statusVariant[cr.status] ?? 'secondary'}>
                {cr.status.toUpperCase()}
              </Badge>
              <span>by {cr.authorName}</span>
              <span>{dayjs(cr.createdAt).format('MMM D, YYYY')}</span>
            </div>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : cr ? (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border">
              {(['items', 'reviewers'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'items' ? `Items (${cr.items.length})` : `Reviewers (${cr.reviewerIds.length})`}
                </button>
              ))}
            </div>

            {/* Items tab */}
            {activeTab === 'items' && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead className="w-16">Locale</TableHead>
                    <TableHead>Before</TableHead>
                    <TableHead>After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cr.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {item.fullKey}
                        </code>
                        {item.comment && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.comment}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{item.locale}</TableCell>
                      <TableCell className="max-w-[150px] text-xs text-muted-foreground/70 line-through">
                        {item.oldValue ?? <span className="not-italic text-muted-foreground/40">(empty)</span>}
                      </TableCell>
                      <TableCell className="max-w-[150px] text-xs text-green-600 dark:text-green-400">
                        {item.newValue}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Reviewers tab */}
            {activeTab === 'reviewers' && (
              <div className="space-y-2">
                {cr.reviewerIds.map((uid) => {
                  const reviewer = userMap[uid]
                  return (
                    <div key={uid} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-sm">{reviewer?.name || reviewer?.email || uid}</span>
                      <Badge variant="secondary" className="text-xs">Reviewer</Badge>
                    </div>
                  )
                })}
                {cr.reviewerIds.length === 0 && (
                  <p className="text-sm text-muted-foreground">No reviewers assigned.</p>
                )}
              </div>
            )}

            {/* Action bar */}
            {(canReview || canPublish) && (
              <>
                <Separator />
                <div className="flex gap-2">
                  {canReview && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleReview('approve')}
                        disabled={reviewMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReview('reject')}
                        disabled={reviewMutation.isPending}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {canPublish && (
                    <Button
                      size="sm"
                      onClick={handlePublish}
                      disabled={publishMutation.isPending}
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish'}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
