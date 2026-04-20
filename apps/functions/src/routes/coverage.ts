import { Router } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { translationKeysCol } from '@hato-tms/firebase'
import type { CoverageStats } from '@hato-tms/shared'
import { Locale } from '@hato-tms/shared'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const db      = getFirestore()
    const [nsSnap, keysSnap] = await Promise.all([
      db.collection('namespaces').where('isActive', '==', true).get(),
      translationKeysCol().where('deletedAt', '==', null).get(),
    ])

    const statsMap = new Map<string, CoverageStats>()

    nsSnap.docs.forEach((d) => {
      statsMap.set(d.id, {
        namespacePath: d.data().path,
        totalKeys: 0, translatedTH: 0, translatedEN: 0,
        pending: 0, coverageTH: 0, coverageEN: 0,
      })
    })

    keysSnap.docs.forEach((d) => {
      const key = d.data() as any
      const stat = statsMap.get(key.namespaceId)
      if (!stat) return

      stat.totalKeys++
      const hasTH = !!key.values?.[Locale.TH]?.value
      const hasEN = !!key.values?.[Locale.EN]?.value
      if (hasTH) stat.translatedTH++
      if (hasEN) stat.translatedEN++
      if (!hasTH || !hasEN) stat.pending++
    })

    const result = Array.from(statsMap.values()).map((s) => ({
      ...s,
      coverageTH: s.totalKeys ? Math.round((s.translatedTH / s.totalKeys) * 100) : 100,
      coverageEN: s.totalKeys ? Math.round((s.translatedEN / s.totalKeys) * 100) : 100,
    }))

    res.json(result)
  } catch (err) { next(err) }
})

router.get('/missing', async (_req, res, next) => {
  try {
    const snap = await translationKeysCol()
      .where('deletedAt', '==', null)
      .where('status',    '==', 'pending')
      .get()

    const missing = snap.docs.map((d) => {
      const key = d.data() as any
      return {
        id:       d.id,
        fullKey:  key.fullKey,
        missingTH: !key.values?.[Locale.TH]?.value,
        missingEN: !key.values?.[Locale.EN]?.value,
      }
    })

    res.json(missing)
  } catch (err) { next(err) }
})

export default router
