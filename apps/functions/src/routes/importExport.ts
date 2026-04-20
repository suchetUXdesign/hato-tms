import { Router } from 'express'
import * as v from 'valibot'
import { translationKeysCol } from '@hato-tms/firebase'
import { Locale } from '@hato-tms/shared'

const router = Router()

// ---- Export ----

router.get('/export/json', async (req, res, next) => {
  try {
    const namespaces = (req.query.namespaces as string)?.split(',').filter(Boolean) ?? []
    const locales    = (req.query.locales as string)?.split(',') as Locale[] ?? [Locale.TH, Locale.EN]
    const format     = (req.query.format as string) ?? 'json_nested'

    let q: any = translationKeysCol().where('deletedAt', '==', null)
    if (namespaces.length) q = q.where('namespacePath', 'in', namespaces.slice(0, 10))

    const snap = await q.get()
    const result: Record<string, Record<string, string>> = {}

    snap.docs.forEach((d: any) => {
      const key = d.data() as any
      locales.forEach((locale) => {
        const value = key.values?.[locale]?.value ?? ''
        if (format === 'json_flat') {
          if (!result[locale]) result[locale] = {}
          result[locale]![key.fullKey] = value
        } else {
          // nested: { "liff.dinein": { "menu": { "confirmButton": "ยืนยัน" } } }
          if (!result[locale]) result[locale] = {}
          const parts = key.fullKey.split('.')
          let node: any = result[locale]
          parts.forEach((part: string, i: number) => {
            if (i === parts.length - 1) { node[part] = value }
            else { node[part] = node[part] ?? {}; node = node[part] }
          })
        }
      })
    })

    res.setHeader('Content-Disposition', `attachment; filename="translations.json"`)
    res.json(result)
  } catch (err) { next(err) }
})

// ---- Import (stub — heavy parsing logic) ----

router.post('/import/json', async (req, res, next) => {
  try {
    // TODO: implement full import with diff preview (preview=true param)
    res.status(501).json({ error: { message: 'Import not yet implemented in PoC' } })
  } catch (err) { next(err) }
})

export default router
