# Change Requests Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Change Requests feature in `apps/web-v2` — list, create, review, and publish.

**Architecture:** Six files total: an API layer, React Query hooks, a Create dialog (shared between Keys page and CR page), a CR detail sheet, the CR list page, and a one-line addition to the Keys page bulk bar. All patterns mirror the existing translation-key feature exactly.

**Tech Stack:** React 19, TanStack React Query 5, shadcn/ui, Tailwind v4, Valibot, `@hato-tms/shared` types, Firebase Auth (`useAuth`), `dayjs`.

---

## File Map

| Action | Path |
|---|---|
| Create | `apps/web-v2/src/shared/api/changeRequests.ts` |
| Create | `apps/web-v2/src/entities/change-request/api/useChangeRequests.ts` |
| Create | `apps/web-v2/src/features/create-change-request/ui/CreateCRDialog.tsx` |
| Create | `apps/web-v2/src/widgets/cr-detail/index.tsx` |
| Modify | `apps/web-v2/src/pages/change-requests/index.tsx` |
| Modify | `apps/web-v2/src/pages/keys/index.tsx` |

---

## Task 1: API Layer

**File:** Create `apps/web-v2/src/shared/api/changeRequests.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { ChangeRequestDTO, UserDTO } from '@hato-tms/shared'
import { CRStatus } from '@hato-tms/shared'
import { apiClient } from './client'

export interface CreateCRPayload {
  title: string
  reviewerIds: string[]
  items: {
    keyId: string
    fullKey: string
    locale: 'TH' | 'EN'
    oldValue: string | null
    newValue: string
    comment?: string
  }[]
}

export interface ReviewCRPayload {
  action: 'approve' | 'reject' | 'request-changes'
  comment?: string
}

export async function getChangeRequests(status?: CRStatus): Promise<ChangeRequestDTO[]> {
  const { data } = await apiClient.get('/change-requests', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function getChangeRequest(id: string): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.get(`/change-requests/${id}`)
  return data
}

export async function createChangeRequest(payload: CreateCRPayload): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.post('/change-requests', payload)
  return data
}

export async function reviewChangeRequest(
  id: string,
  payload: ReviewCRPayload,
): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.put(`/change-requests/${id}/review`, payload)
  return data
}

export async function publishChangeRequest(id: string): Promise<ChangeRequestDTO> {
  const { data } = await apiClient.put(`/change-requests/${id}/publish`, {})
  return data
}

export async function getUsers(): Promise<UserDTO[]> {
  const { data } = await apiClient.get('/auth/users')
  return data
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/shared/api/changeRequests.ts
git commit -m "feat(web-v2): add change requests API layer"
```

---

## Task 2: Entity Hooks

**File:** Create `apps/web-v2/src/entities/change-request/api/useChangeRequests.ts`

- [ ] **Step 1: Create the file**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CRStatus } from '@hato-tms/shared'
import {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  reviewChangeRequest,
  publishChangeRequest,
  getUsers,
  type CreateCRPayload,
  type ReviewCRPayload,
} from '@/shared/api/changeRequests'

export function useChangeRequests(status?: CRStatus) {
  return useQuery({
    queryKey: ['change-requests', status],
    queryFn: () => getChangeRequests(status),
  })
}

export function useChangeRequest(id: string | null) {
  return useQuery({
    queryKey: ['change-request', id],
    queryFn: () => getChangeRequest(id!),
    enabled: !!id,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
}

export function useCreateChangeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCRPayload) => createChangeRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
  })
}

export function useReviewChangeRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReviewCRPayload) => reviewChangeRequest(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-request', id] })
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
  })
}

export function usePublishChangeRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => publishChangeRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-request', id] })
      qc.invalidateQueries({ queryKey: ['change-requests'] })
      qc.invalidateQueries({ queryKey: ['keys'] })
    },
  })
}
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/entities/change-request/api/useChangeRequests.ts
git commit -m "feat(web-v2): add change request entity hooks"
```

---

## Task 3: Create CR Dialog

**File:** Create `apps/web-v2/src/features/create-change-request/ui/CreateCRDialog.tsx`

This dialog is opened from two places:
- Keys page bulk bar → passes `preselectedKeys` prop (pre-populates items)
- CR list page header → opens empty (`preselectedKeys` = undefined)

The form has three sections: title, items (with key search + add), and reviewer picker.

- [ ] **Step 1: Create the file**

```typescript
import { useState, useEffect } from 'react'
import * as v from 'valibot'
import { X, Plus, Search } from 'lucide-react'
import { Locale, type TranslationKeyDTO } from '@hato-tms/shared'
import { useCreateChangeRequest, useUsers } from '@/entities/change-request/api/useChangeRequests'
import { getKeys } from '@/shared/api/keys'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/ui/select'
import { toast } from 'sonner'

interface CRItemDraft {
  keyId: string
  fullKey: string
  locale: 'TH' | 'EN'
  oldValue: string | null
  newValue: string
  comment: string
}

interface Props {
  open: boolean
  onClose: () => void
  preselectedKeys?: TranslationKeyDTO[]
}

const CreateCRSchema = v.object({
  title:       v.pipe(v.string(), v.minLength(1, 'Title is required')),
  reviewerIds: v.pipe(v.array(v.string()), v.minLength(1, 'At least one reviewer required')),
  items:       v.pipe(v.array(v.object({
    keyId:    v.string(),
    fullKey:  v.string(),
    locale:   v.enum(Locale),
    oldValue: v.nullable(v.string()),
    newValue: v.pipe(v.string(), v.minLength(1, 'New value is required')),
    comment:  v.optional(v.string()),
  })), v.minLength(1, 'At least one item required')),
})

function buildItemsFromKeys(keys: TranslationKeyDTO[]): CRItemDraft[] {
  const items: CRItemDraft[] = []
  for (const key of keys) {
    const th = key.values.find((v) => v.locale.toUpperCase() === 'TH')
    const en = key.values.find((v) => v.locale.toUpperCase() === 'EN')
    items.push({ keyId: key.id, fullKey: key.fullKey, locale: 'TH', oldValue: th?.value ?? null, newValue: th?.value ?? '', comment: '' })
    items.push({ keyId: key.id, fullKey: key.fullKey, locale: 'EN', oldValue: en?.value ?? null, newValue: en?.value ?? '', comment: '' })
  }
  return items
}

export function CreateCRDialog({ open, onClose, preselectedKeys }: Props) {
  const createCR  = useCreateChangeRequest()
  const { data: users } = useUsers()

  const [title,       setTitle]       = useState('')
  const [items,       setItems]       = useState<CRItemDraft[]>([])
  const [reviewerIds, setReviewerIds] = useState<string[]>([])
  const [errors,      setErrors]      = useState<Record<string, string>>({})

  // Key search state
  const [keySearch,        setKeySearch]        = useState('')
  const [keySearchResults, setKeySearchResults] = useState<TranslationKeyDTO[]>([])
  const [searching,        setSearching]        = useState(false)

  useEffect(() => {
    if (open && preselectedKeys?.length) {
      setItems(buildItemsFromKeys(preselectedKeys))
    }
  }, [open, preselectedKeys])

  const resetForm = () => {
    setTitle(''); setItems([]); setReviewerIds([])
    setErrors({}); setKeySearch(''); setKeySearchResults([])
  }

  const handleClose = () => { resetForm(); onClose() }

  const searchKeys = async (q: string) => {
    if (!q.trim()) { setKeySearchResults([]); return }
    setSearching(true)
    try {
      const res = await getKeys({ query: q, pageSize: 10 })
      setKeySearchResults(res.data.filter((k) => !items.some((i) => i.keyId === k.id)))
    } catch { setKeySearchResults([]) }
    finally { setSearching(false) }
  }

  const addKey = (key: TranslationKeyDTO) => {
    const th = key.values.find((v) => v.locale.toUpperCase() === 'TH')
    const en = key.values.find((v) => v.locale.toUpperCase() === 'EN')
    setItems((prev) => [
      ...prev,
      { keyId: key.id, fullKey: key.fullKey, locale: 'TH', oldValue: th?.value ?? null, newValue: th?.value ?? '', comment: '' },
      { keyId: key.id, fullKey: key.fullKey, locale: 'EN', oldValue: en?.value ?? null, newValue: en?.value ?? '', comment: '' },
    ])
    setKeySearch(''); setKeySearchResults([])
  }

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const updateItem = (index: number, field: keyof CRItemDraft, value: string) =>
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))

  const toggleReviewer = (uid: string) =>
    setReviewerIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = v.safeParse(CreateCRSchema, {
      title,
      reviewerIds,
      items: items.map((i) => ({ ...i, comment: i.comment || undefined })),
    })
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.issues) {
        const key = String(issue.path?.[0]?.key ?? 'general')
        errs[key] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})
    createCR.mutate(
      { title, reviewerIds, items: items.map((i) => ({ ...i, comment: i.comment || undefined })) },
      {
        onSuccess: () => { toast.success('Change request created'); handleClose() },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? 'Failed to create change request'
          toast.error(msg)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Change Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="cr-title">Title</Label>
            <Input
              id="cr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Update checkout flow labels"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Translation Changes</Label>
            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}

            {items.length > 0 && (
              <div className="space-y-2 rounded-md border border-border p-3">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_1fr_auto] gap-2 text-sm items-start">
                    <div>
                      <code className="text-xs text-muted-foreground">{item.fullKey}</code>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Old: {item.oldValue ?? <span className="italic">(empty)</span>}
                      </div>
                    </div>
                    <Select
                      value={item.locale}
                      onValueChange={(v) => updateItem(idx, 'locale', v as 'TH' | 'EN')}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TH">TH</SelectItem>
                        <SelectItem value="EN">EN</SelectItem>
                      </SelectContent>
                    </Select>
                    <Textarea
                      className="h-16 text-sm"
                      value={item.newValue}
                      onChange={(e) => updateItem(idx, 'newValue', e.target.value)}
                      placeholder="New value"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="mt-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Key search */}
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search keys to add..."
                    value={keySearch}
                    onChange={(e) => { setKeySearch(e.target.value); searchKeys(e.target.value) }}
                  />
                </div>
              </div>
              {keySearchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                  {keySearchResults.map((key) => (
                    <button
                      key={key.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => addKey(key)}
                    >
                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                      <code className="text-xs">{key.fullKey}</code>
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <p className="mt-1 text-xs text-muted-foreground">Searching...</p>
              )}
            </div>
          </div>

          {/* Reviewers */}
          <div className="space-y-2">
            <Label>Reviewers</Label>
            {errors.reviewerIds && <p className="text-xs text-destructive">{errors.reviewerIds}</p>}
            <div className="flex flex-wrap gap-2">
              {(users ?? []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleReviewer(u.id)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    reviewerIds.includes(u.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {u.name || u.email}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={createCR.isPending}>
              {createCR.isPending ? 'Creating...' : 'Create Change Request'}
            </Button>
          </DialogFooter>
        </form>
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
git add apps/web-v2/src/features/create-change-request/ui/CreateCRDialog.tsx
git commit -m "feat(web-v2): add CreateCRDialog feature component"
```

---

## Task 4: CR Detail Sheet

**File:** Create `apps/web-v2/src/widgets/cr-detail/index.tsx`

Key data shape note: `ChangeRequestDTO.reviewerIds` is an array of user ID strings (no names). The sheet cross-references with the users list to show names. Reviewer approval status is not in the DTO — the sheet shows the CR status and item list instead.

Review button visibility rules:
- Show review buttons when: `cr.status === 'pending'` AND `cr.reviewerIds.includes(user.uid)` AND `cr.authorId !== user.uid`
- Show publish button when: `cr.status === 'approved'`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/widgets/cr-detail/index.tsx
git commit -m "feat(web-v2): add CRDetailSheet widget"
```

---

## Task 5: CR List Page

**File:** Modify `apps/web-v2/src/pages/change-requests/index.tsx`

Replace the placeholder entirely.

- [ ] **Step 1: Rewrite the file**

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/pages/change-requests/index.tsx
git commit -m "feat(web-v2): implement change requests list page"
```

---

## Task 6: Keys Page — Add "Create CR" to Bulk Bar

**File:** Modify `apps/web-v2/src/pages/keys/index.tsx`

Three changes:
1. Import `CreateCRDialog` and `useState` for the dialog
2. Add `createCROpen` state and a `keysForCR` state
3. Add "Create CR" button to the bulk action bar; clicking it stores the selected keys and opens the dialog

- [ ] **Step 1: Add imports** at the top of the file (after the existing `CreateKeyDialog` import line):

```typescript
import { CreateCRDialog } from '@/features/create-change-request/ui/CreateCRDialog'
```

- [ ] **Step 2: Add state** inside `KeysPage`, after the `[selectedIds, setSelectedIds]` state line:

```typescript
const [createCROpen, setCreateCROpen] = useState(false)
const [keysForCR,    setKeysForCR]    = useState<TranslationKeyDTO[]>([])
```

- [ ] **Step 3: Add "Create CR" button** to the existing bulk action bar. Find the bulk action bar section — the `div` with class `fixed bottom-6 left-1/2`. Add the button between the Delete button and the Clear button:

```tsx
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
```

- [ ] **Step 4: Add dialog** at the bottom of the return, after the existing `<KeyDetailSheet ... />` line:

```tsx
<CreateCRDialog
  open={createCROpen}
  onClose={() => { setCreateCROpen(false); setKeysForCR([]) }}
  preselectedKeys={keysForCR}
/>
```

- [ ] **Step 5: Type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web-v2/src/pages/keys/index.tsx
git commit -m "feat(web-v2): add Create CR action to Keys page bulk bar"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full type-check**

```bash
npm -w @hato-tms/web-v2 run lint
```

Expected: zero errors.

- [ ] **Step 2: Start dev server and smoke-test**

```bash
npm -w @hato-tms/web-v2 run dev
```

Verify manually:
- `/change-requests` loads with status tabs and table
- "New CR" button opens `CreateCRDialog` with empty items
- Keys page: select 2 keys → bulk bar shows "Create CR" → click opens dialog with items pre-populated
- Click a CR row → `CRDetailSheet` opens with Items tab and Reviewers tab
- Review buttons visible only when correct conditions are met (pending + is reviewer + not author)
- Publish button visible only when status is approved

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(web-v2): complete Step 5 – Change Requests feature"
```
