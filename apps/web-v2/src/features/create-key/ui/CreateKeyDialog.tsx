import { useState } from 'react'
import * as v from 'valibot'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Platform, validateKeyName, buildFullKey } from '@hato-tms/shared'
import { useCreateKey } from '@/entities/translation-key/api/useKeys'
import { useNamespaces } from '@/entities/namespace/api/useNamespaces'
import { getKeys } from '@/shared/api/keys'
import { useTranslation } from '@/shared/lib/useTranslation'
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
import { toast } from 'sonner'

const CreateKeySchema = v.object({
  namespacePath: v.pipe(v.string(), v.minLength(1, 'Namespace is required')),
  keyName: v.pipe(
    v.string(),
    v.minLength(1, 'Key name is required'),
    v.check((val) => validateKeyName(val), 'Must be camelCase (e.g. welcomeMessage)'),
  ),
  thValue: v.pipe(v.string(), v.minLength(1, 'Thai value is required')),
  enValue: v.pipe(v.string(), v.minLength(1, 'English value is required')),
  description: v.optional(v.string()),
  tags: v.optional(v.string()),
  platforms: v.optional(v.array(v.enum(Platform))),
})

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateKeyDialog({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { data: namespaces } = useNamespaces()
  const createKey = useCreateKey()

  const [namespacePath, setNamespacePath] = useState('')
  const [keyName, setKeyName]             = useState('')
  const [thValue, setThValue]             = useState('')
  const [enValue, setEnValue]             = useState('')
  const [description, setDescription]     = useState('')
  const [tagsInput, setTagsInput]         = useState('')
  const [platforms, setPlatforms]         = useState<Platform[]>([])
  const [showAdvanced, setShowAdvanced]   = useState(false)
  const [duplicateWarning, setDuplicate]  = useState<string | null>(null)
  const [errors, setErrors]               = useState<Record<string, string>>({})

  const resetForm = () => {
    setNamespacePath(''); setKeyName(''); setThValue(''); setEnValue('')
    setDescription(''); setTagsInput(''); setPlatforms([])
    setShowAdvanced(false); setDuplicate(null); setErrors({})
  }

  const handleClose = () => { resetForm(); onClose() }

  const checkDuplicate = async () => {
    if (!namespacePath || !keyName) { setDuplicate(null); return }
    try {
      const full = buildFullKey(namespacePath, keyName)
      const res  = await getKeys({ query: full, pageSize: 1 })
      setDuplicate(res.data.some((k) => k.fullKey === full) ? t('error.duplicateKey') : null)
    } catch { setDuplicate(null) }
  }

  const togglePlatform = (p: Platform) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = v.safeParse(CreateKeySchema, {
      namespacePath, keyName, thValue, enValue,
      description: description || undefined,
    })
    if (!result.success) {
      const errs: Record<string, string> = {}
      for (const issue of result.issues) {
        const field = issue.path?.[0]?.key as string
        if (field) errs[field] = issue.message
      }
      setErrors(errs)
      return
    }
    setErrors({})
    createKey.mutate(
      {
        namespacePath,
        keyName,
        thValue,
        enValue,
        description: description || undefined,
        tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        platforms: platforms.length ? platforms : undefined,
      },
      {
        onSuccess: () => { toast.success(t('success.keyCreated')); handleClose() },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? t('error.saveFailed')
          toast.error(msg)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t('cta.newKey')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Namespace */}
          <div className="space-y-1.5">
            <Label htmlFor="ns">{t('filter.namespace')}</Label>
            <Input
              id="ns"
              list="ns-options"
              value={namespacePath}
              onChange={(e) => setNamespacePath(e.target.value)}
              onBlur={checkDuplicate}
              placeholder={t('createKey.nsPlaceholder')}
            />
            <datalist id="ns-options">
              {(namespaces ?? []).map((ns) => (
                <option key={ns.id} value={ns.path} />
              ))}
            </datalist>
            {errors.namespacePath && (
              <p className="text-xs text-destructive">{errors.namespacePath}</p>
            )}
          </div>

          {/* Key name */}
          <div className="space-y-1.5">
            <Label htmlFor="key">{t('createKey.keyName')}</Label>
            <Input
              id="key"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              onBlur={checkDuplicate}
              placeholder={t('createKey.keyPlaceholder')}
            />
            {errors.keyName && (
              <p className="text-xs text-destructive">{errors.keyName}</p>
            )}
            {duplicateWarning && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">{duplicateWarning}</p>
            )}
          </div>

          {/* TH */}
          <div className="space-y-1.5">
            <Label htmlFor="th">{t('createKey.thValue')}</Label>
            <Textarea
              id="th"
              rows={2}
              value={thValue}
              onChange={(e) => setThValue(e.target.value)}
              placeholder={t('createKey.thPlaceholder')}
            />
            {errors.thValue && (
              <p className="text-xs text-destructive">{errors.thValue}</p>
            )}
          </div>

          {/* EN */}
          <div className="space-y-1.5">
            <Label htmlFor="en">{t('createKey.enValue')}</Label>
            <Textarea
              id="en"
              rows={2}
              value={enValue}
              onChange={(e) => setEnValue(e.target.value)}
              placeholder={t('createKey.enPlaceholder')}
            />
            {errors.enValue && (
              <p className="text-xs text-destructive">{errors.enValue}</p>
            )}
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAdvanced ? t('createKey.lessOptions') : t('createKey.moreOptions')}
          </button>

          {showAdvanced && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="desc">{t('detail.description')}</Label>
                <Textarea
                  id="desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('createKey.descPlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">{t('detail.tags')}</Label>
                <Input
                  id="tags"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={t('createKey.addTags') + ' (comma-separated)'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('createKey.platformScope')}</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(Platform).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        platforms.includes(p)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createKey.isPending}>
              {createKey.isPending ? 'Creating...' : t('createKey.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
