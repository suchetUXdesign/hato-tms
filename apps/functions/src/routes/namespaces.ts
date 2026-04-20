import { Router } from 'express'
import * as v from 'valibot'
import { getNamespaceRepository } from '../container'
import { AppError } from '../middleware/error'
import { Platform } from '@hato-tms/shared'

const router = Router()

const NamespaceSchema = v.object({
  path:        v.pipe(v.string(), v.regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/, 'dot.notation.only')),
  description: v.optional(v.string()),
  platforms:   v.optional(v.array(v.enum(Platform))),
})

router.get('/', async (_req, res, next) => {
  try {
    res.json(await getNamespaceRepository().findMany())
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const data = v.parse(NamespaceSchema, req.body)
    res.status(201).json(await getNamespaceRepository().create(data))
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const data = v.parse(v.partial(NamespaceSchema), req.body)
    res.json(await getNamespaceRepository().update(req.params.id, data))
  } catch (err) { next(err) }
})

export default router
