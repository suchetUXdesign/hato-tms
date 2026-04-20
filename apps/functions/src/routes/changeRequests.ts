import { Router } from 'express'
import * as v from 'valibot'
import { getChangeRequestRepository } from '../container'
import { AppError } from '../middleware/error'
import { CRStatus, Locale } from '@hato-tms/shared'

const router = Router()

const CRItemSchema = v.object({
  keyId:    v.string(),
  fullKey:  v.string(),
  locale:   v.enum(Locale),
  oldValue: v.nullable(v.string()),
  newValue: v.string(),
  comment:  v.optional(v.string()),
})

const CreateCRSchema = v.object({
  title:       v.pipe(v.string(), v.minLength(1)),
  reviewerIds: v.array(v.string()),
  items:       v.pipe(v.array(CRItemSchema), v.minLength(1, 'At least one item required')),
})

const ReviewSchema = v.object({
  action:  v.picklist(['approve', 'reject', 'request-changes']),
  comment: v.optional(v.string()),
})

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as CRStatus | undefined
    res.json(await getChangeRequestRepository().findMany(status ? { status } : undefined))
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const data = v.parse(CreateCRSchema, req.body)
    const cr   = await getChangeRequestRepository().create(data, req.user.id, req.user.name)
    res.status(201).json(cr)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const cr = await getChangeRequestRepository().findById(req.params.id)
    if (!cr) throw new AppError('Change request not found', 404)
    res.json(cr)
  } catch (err) { next(err) }
})

router.put('/:id/review', async (req, res, next) => {
  try {
    const input = v.parse(ReviewSchema, req.body)
    const cr    = await getChangeRequestRepository().findById(req.params.id)
    if (!cr) throw new AppError('Change request not found', 404)

    // Self-approval guard
    if (cr.authorId === req.user.id && input.action === 'approve') {
      throw new AppError('Cannot approve your own change request', 403)
    }

    res.json(await getChangeRequestRepository().review(req.params.id, req.user.id, input))
  } catch (err) { next(err) }
})

router.put('/:id/publish', async (req, res, next) => {
  try {
    res.json(await getChangeRequestRepository().publish(req.params.id, req.user.id, req.user.name))
  } catch (err) { next(err) }
})

export default router
