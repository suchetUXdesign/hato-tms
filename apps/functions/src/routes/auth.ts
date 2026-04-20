import { Router } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getUserRepository } from '../container'
import { AppError } from '../middleware/error'
import type { UserRole } from '@hato-tms/shared'

const router = Router()

/**
 * GET /api/v1/auth/me
 * Returns the current user profile. Creates user doc on first login.
 */
router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('Missing token', 401)

    const idToken = authHeader.split('Bearer ')[1]!
    const decoded = await getAuth().verifyIdToken(idToken)
    const repo    = getUserRepository()

    let user = await repo.findById(decoded.uid)

    // Auto-provision user on first login
    if (!user) {
      user = await repo.create({
        uid:   decoded.uid,
        email: decoded.email ?? '',
        name:  decoded.name ?? decoded.email ?? 'Unknown',
        role:  'VIEWER' as UserRole,
      })
    }

    res.json(user)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/v1/auth/token/regenerate
 * Regenerate the API token for CLI / Figma plugin use.
 */
router.post('/token/regenerate', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) throw new AppError('Missing token', 401)

    const idToken = authHeader.split('Bearer ')[1]!
    const decoded = await getAuth().verifyIdToken(idToken)
    const token   = await getUserRepository().regenerateApiToken(decoded.uid)

    res.json({ token })
  } catch (err) {
    next(err)
  }
})

export default router
