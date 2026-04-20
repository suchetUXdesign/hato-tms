import { Router } from 'express'
import * as v from 'valibot'
import { getUserRepository } from '../container'
import { AppError } from '../middleware/error'
import { UserRole } from '@hato-tms/shared'
import { requireRole } from '../middleware/auth'

const router = Router()

const UpdateUserSchema = v.object({
  name:     v.optional(v.string()),
  role:     v.optional(v.enum(UserRole)),
  isActive: v.optional(v.boolean()),
})

const InviteSchema = v.object({
  uid:   v.string(),
  email: v.pipe(v.string(), v.email()),
  name:  v.pipe(v.string(), v.minLength(1)),
  role:  v.enum(UserRole),
})

router.get('/', requireRole('ADMIN'), async (_req, res, next) => {
  try {
    res.json(await getUserRepository().findMany())
  } catch (err) { next(err) }
})

router.post('/invite', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = v.parse(InviteSchema, req.body)
    res.status(201).json(await getUserRepository().create(data))
  } catch (err) { next(err) }
})

router.put('/:uid', requireRole('ADMIN'), async (req, res, next) => {
  try {
    // Cannot change own role
    if (req.params.uid === req.user.id && req.body.role) {
      throw new AppError('Cannot change your own role', 403)
    }
    const data = v.parse(UpdateUserSchema, req.body)
    res.json(await getUserRepository().update(req.params.uid, data))
  } catch (err) { next(err) }
})

router.delete('/:uid', requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (req.params.uid === req.user.id) throw new AppError('Cannot deactivate yourself', 403)
    res.json(await getUserRepository().deactivate(req.params.uid))
  } catch (err) { next(err) }
})

export default router
