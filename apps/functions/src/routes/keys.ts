import { Router } from 'express'
import * as v from 'valibot'
import { getKeyRepository } from '../container'
import { AppError } from '../middleware/error'
import { Platform, Locale, KeyStatus } from '@hato-tms/shared'
import { requireRole } from '../middleware/auth'

const router = Router()

// ---- Schemas ----

const CreateKeySchema = v.object({
  namespacePath: v.pipe(v.string(), v.minLength(1)),
  keyName:       v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)*$/, 'Invalid key format')),
  thValue:       v.pipe(v.string(), v.minLength(1)),
  enValue:       v.pipe(v.string(), v.minLength(1)),
  description:   v.optional(v.string()),
  tags:          v.optional(v.array(v.string())),
  platforms:     v.optional(v.array(v.enum(Platform))),
})

const UpdateKeySchema = v.object({
  keyName:     v.optional(v.string()),
  description: v.optional(v.string()),
  tags:        v.optional(v.array(v.string())),
  platforms:   v.optional(v.array(v.enum(Platform))),
})

const UpdateValueSchema = v.object({
  locale: v.enum(Locale),
  value:  v.string(),
})

// ---- Routes ----

router.get('/', async (req, res, next) => {
  try {
    const result = await getKeyRepository().findMany(req.query as any)
    res.json(result)
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const data = v.parse(CreateKeySchema, req.body)
    const key  = await getKeyRepository().create(data, req.user.id, req.user.name)
    res.status(201).json(key)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const key = await getKeyRepository().findById(req.params.id)
    if (!key) throw new AppError('Key not found', 404)
    res.json(key)
  } catch (err) { next(err) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    const data = v.parse(UpdateKeySchema, req.body)
    const key  = await getKeyRepository().update(req.params.id, data, req.user.id)
    res.json(key)
  } catch (err) { next(err) }
})

router.put('/:id/values', async (req, res, next) => {
  try {
    const data = v.parse(UpdateValueSchema, req.body)
    const key  = await getKeyRepository().updateValue(req.params.id, data, req.user.id, req.user.name)
    res.json(key)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    await getKeyRepository().softDelete(req.params.id)
    res.status(204).send()
  } catch (err) { next(err) }
})

router.get('/:id/history', async (req, res, next) => {
  try {
    const logs = await getKeyRepository().findHistory(req.params.id)
    res.json(logs)
  } catch (err) { next(err) }
})

// ---- Bulk ----

router.post('/bulk/delete', async (req, res, next) => {
  try {
    const { ids } = v.parse(v.object({ ids: v.array(v.string()) }), req.body)
    await getKeyRepository().bulkDelete(ids)
    res.json({ deleted: ids.length })
  } catch (err) { next(err) }
})

router.post('/bulk/tag', async (req, res, next) => {
  try {
    const { ids, tags } = v.parse(v.object({ ids: v.array(v.string()), tags: v.array(v.string()) }), req.body)
    await getKeyRepository().bulkAddTags(ids, tags)
    res.json({ updated: ids.length })
  } catch (err) { next(err) }
})

router.post('/bulk/move', async (req, res, next) => {
  try {
    const { ids, namespaceId, namespacePath } = v.parse(
      v.object({ ids: v.array(v.string()), namespaceId: v.string(), namespacePath: v.string() }),
      req.body,
    )
    await getKeyRepository().bulkMove(ids, namespaceId, namespacePath)
    res.json({ moved: ids.length })
  } catch (err) { next(err) }
})

export default router
