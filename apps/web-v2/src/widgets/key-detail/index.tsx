import { useState, useEffect, useMemo } from 'react'
import { Pencil, Check, X, Trash2, Plus, Tag } from 'lucide-react'
import { KeyStatus } from '@hato-tms/shared'
import {
  useKey,
  useKeyHistory,
  useSaveKey,
  useDeleteKey,
} from '@/entities/translation-key/api/useKeys'
import { useTranslation } from '@/shared/lib/useTranslation'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { Badge } from '@/shared/ui/badge'
import { Separator } from '@/shared/ui/separator'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/shared/ui/dialog'
import { toast } from 'sonner'
import dayjs from 'dayjs'

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [KeyStatus.TRANSLATED]: 'default',
  [KeyStatus.PENDING]:    'secondary',
  [KeyStatus.IN_REVIEW]:  'outline',
}

// ---- Editable Tags ----
function EditableTags({
  tags, onChange, readOnly,
}: { tags: string[]; onChange: (t: string[]) => void; readOnly: boolean }) {
  const { t } = useTranslation()
  const [inputVisible, setInputVisible] = useState(false)
  const [inputValue, setInputValue]     = useState('')

  const confirm = () => {
    const trimmed = inputValue.trim()
    if (trimmed) {
      if (tags.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
        toast.warning(t('detail.duplicateTag'))
      } else {
        onChange([...tags, trimmed])
      }
    }
    setInputVisible(false)
    setInputValue('')
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
        >
          {tag}
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== tag))}
              className="ml-0.5 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        inputVisible ? (
          <input
            autoFocus
            className="h-6 w-24 rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={confirm}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirm() } }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setInputVisible(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> {t('detail.addTag')}
          </button>
        )
      )}
      {readOnly && tags.length === 0 && (
        <span className="text-xs text-muted-foreground">{t('detail.none')}</span>
      )}
    </div>
  )
}

// ---- Props ----
interface Props {
  keyId: string | null
  open: boolean
  onClose: () => void
}

export function KeyDetailSheet({ keyId, open, onClose }: Props) {
  const { t }              = useTranslation()
  const { data: keyData, isLoading } = useKey(keyId)
  const { data: history,  isLoading: historyLoading } = useKeyHistory(keyId)
  const saveMutation   = useSaveKey(keyId)
  const deleteMutation = useDeleteKey()

  const [isEditing, setIsEditing]   = useState(false)
  const [draftTH, setDraftTH]       = useState('')
  const [draftEN, setDraftEN]       = useState('')
  const [draftTags, setDraftTags]   = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const thValue = keyData?.values.find((v) => v.locale.toUpperCase() === 'TH')
  const enValue = keyData?.values.find((v) => v.locale.toUpperCase() === 'EN')

  useEffect(() => {
    if (keyData && !isEditing) {
      setDraftTH(thValue?.value ?? '')
      setDraftEN(enValue?.value ?? '')
      setDraftTags([...keyData.tags])
    }
  }, [keyData, isEditing])

  useEffect(() => { setIsEditing(false) }, [keyId, open])

  const hasChanges = useMemo(() => {
    if (!keyData) return false
    return (
      draftTH !== (thValue?.value ?? '') ||
      draftEN !== (enValue?.value ?? '') ||
      JSON.stringify([...draftTags].sort()) !== JSON.stringify([...keyData.tags].sort())
    )
  }, [draftTH, draftEN, draftTags, keyData, thValue, enValue])

  const handleSave = () => {
    saveMutation.mutate(
      { th: draftTH, en: draftEN, tags: draftTags },
      {
        onSuccess: (res) => {
          if ((res as { message?: string }).message === 'no_changes') {
            toast.info(t('detail.noChanges'))
          } else {
            toast.success(`${t('detail.saveAll')} — ${res.changes.length} ${t('detail.fieldsChanged')}`)
          }
          setIsEditing(false)
        },
        onError: () => toast.error(t('error.saveFailed')),
      },
    )
  }

  const handleDelete = () => {
    deleteMutation.mutate(keyId!, {
      onSuccess: () => { toast.success(t('success.keyDeleted')); onClose() },
      onError:   () => toast.error(t('error.deleteKey')),
    })
  }

  const handleDiscard = () => {
    setDraftTH(thValue?.value ?? '')
    setDraftEN(enValue?.value ?? '')
    setDraftTags([...(keyData?.tags ?? [])])
    setIsEditing(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-mono text-sm">{keyData?.fullKey ?? 'Key Detail'}</SheetTitle>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              {!isEditing ? (
                <Button size="sm" variant="outline" onClick={() => {
                  setDraftTH(thValue?.value ?? '')
                  setDraftEN(enValue?.value ?? '')
                  setDraftTags([...(keyData?.tags ?? [])])
                  setIsEditing(true)
                }}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />{t('detail.edit')}
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleDiscard} disabled={saveMutation.isPending}>
                    <X className="mr-1.5 h-3.5 w-3.5" />{t('detail.discard')}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    {saveMutation.isPending ? 'Saving...' : t('detail.saveAll')}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleteMutation.isPending}
                className="ml-auto"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('detail.delete')}
              </Button>
            </div>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : keyData ? (
            <div className="space-y-5">
              {/* Metadata */}
              <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">{t('filter.namespace')}</span>
                <span className="font-mono text-xs">{keyData.namespacePath}</span>

                <span className="text-muted-foreground">{t('detail.description')}</span>
                <span>{keyData.description || <span className="text-muted-foreground">{t('detail.none')}</span>}</span>

                <span className="text-muted-foreground">{t('col.status')}</span>
                <Badge variant={statusVariant[keyData.status] ?? 'secondary'}>
                  {keyData.status.toUpperCase()}
                </Badge>

                <span className="text-muted-foreground">{t('detail.platforms')}</span>
                <div className="flex flex-wrap gap-1">
                  {keyData.platforms.length ? keyData.platforms.map((p) => (
                    <span key={p} className="rounded border border-border px-1.5 py-0.5 text-xs">{p}</span>
                  )) : <span className="text-muted-foreground text-xs">{t('detail.none')}</span>}
                </div>
              </div>

              <Separator />

              {/* Tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="h-3.5 w-3.5" />{t('detail.tags')}
                </div>
                <EditableTags
                  tags={isEditing ? draftTags : keyData.tags}
                  onChange={setDraftTags}
                  readOnly={!isEditing}
                />
              </div>

              <Separator />

              {/* TH value */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">TH (ไทย)</p>
                {isEditing ? (
                  <Textarea autoFocus rows={3} value={draftTH} onChange={(e) => setDraftTH(e.target.value)} />
                ) : (
                  <div className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm">
                    {thValue?.value || <span className="text-muted-foreground">{t('detail.empty')}</span>}
                  </div>
                )}
              </div>

              {/* EN value */}
              <div className="space-y-1.5">
                <p className="text-sm font-medium">EN (English)</p>
                {isEditing ? (
                  <Textarea rows={3} value={draftEN} onChange={(e) => setDraftEN(e.target.value)} />
                ) : (
                  <div className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm">
                    {enValue?.value || <span className="text-muted-foreground">{t('detail.empty')}</span>}
                  </div>
                )}
              </div>

              <Separator />

              {/* History */}
              <div>
                <p className="mb-3 text-sm font-medium">{t('detail.versionHistory')}</p>
                {historyLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <ol className="relative border-l border-border pl-4 space-y-4">
                    {(history ?? []).map((entry, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                        {entry.action === 'key.created' ? (
                          <div>
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">
                              {t('detail.keyCreated')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dayjs(entry.changedAt).format('YYYY-MM-DD HH:mm')}
                              {entry.changedBy ? ` by ${entry.changedBy}` : ''}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs font-medium">
                              {entry.changes.length} {t('detail.fieldsChanged')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {dayjs(entry.changedAt).format('YYYY-MM-DD HH:mm')}
                              {entry.changedBy ? ` by ${entry.changedBy}` : ''}
                            </p>
                            {entry.changes.map((c, ci) => (
                              <div key={ci} className="mt-1 rounded bg-muted p-1.5 text-xs">
                                <span className="font-medium">{c.fieldPath.toUpperCase()}</span>
                                <div className="line-through text-destructive/80">{String(c.from || '(empty)')}</div>
                                <div className="text-green-600 dark:text-green-400">{String(c.to || '(empty)')}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                    {(!history || history.length === 0) && (
                      <li className="text-xs text-muted-foreground">
                        {t('detail.keyCreated')} {dayjs(keyData.createdAt).format('YYYY-MM-DD HH:mm')}
                      </li>
                    )}
                  </ol>
                )}
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete confirm dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('detail.deleteConfirm')}</DialogTitle>
            <DialogDescription>{t('detail.deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => { setConfirmDelete(false); handleDelete() }}
              disabled={deleteMutation.isPending}
            >
              {t('detail.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
