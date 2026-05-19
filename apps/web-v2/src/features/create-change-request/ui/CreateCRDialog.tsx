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
