import { http, HttpResponse, delay } from 'msw'
import {
  mockUsers,
  mockNamespaces,
  mockKeys,
  mockChangeRequests,
  mockImportPreview,
} from './data'
import type { TranslationKeyDTO, ChangeRequestDTO } from '@hato-tms/shared'

// in-memory state so mutations persist within a session
let keys = [...mockKeys]
let changeRequests = [...mockChangeRequests]

const BASE = '/api/v1'

export const handlers = [

  // ── Auth / Users ─────────────────────────────────────────────────────────

  http.get(`${BASE}/auth/users`, async () => {
    await delay(150)
    return HttpResponse.json(mockUsers)
  }),

  http.get(`${BASE}/auth/me`, async () => {
    await delay(100)
    return HttpResponse.json({ ...mockUsers[0], apiToken: 'mock-dev-token-123' })
  }),

  // ── Namespaces ────────────────────────────────────────────────────────────

  http.get(`${BASE}/namespaces`, async () => {
    await delay(150)
    return HttpResponse.json({ data: mockNamespaces })
  }),

  // ── Translation Keys ──────────────────────────────────────────────────────

  http.get(`${BASE}/keys`, async ({ request }) => {
    await delay(200)
    const url = new URL(request.url)
    const query     = url.searchParams.get('query')?.toLowerCase()
    const namespace = url.searchParams.get('namespace')
    const status    = url.searchParams.get('status')
    const page      = Number(url.searchParams.get('page') ?? 1)
    const pageSize  = Number(url.searchParams.get('pageSize') ?? 20)

    const filtered = keys.filter((k) => {
      if (query     && !k.fullKey.toLowerCase().includes(query) && !k.values.some((v) => v.value.toLowerCase().includes(query))) return false
      if (namespace && k.namespacePath !== namespace) return false
      if (status    && k.status !== status) return false
      return true
    })

    const total = filtered.length
    const data  = filtered.slice((page - 1) * pageSize, page * pageSize)

    return HttpResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  }),

  http.get(`${BASE}/keys/:id`, async ({ params }) => {
    await delay(150)
    const key = keys.find((k) => k.id === params.id)
    if (!key) return HttpResponse.json({ error: { message: 'Key not found' } }, { status: 404 })
    return HttpResponse.json(key)
  }),

  http.get(`${BASE}/keys/:id/history`, async ({ params }) => {
    await delay(150)
    const key = keys.find((k) => k.id === params.id)
    if (!key) return HttpResponse.json({ history: [] })
    return HttpResponse.json({
      history: [
        { id: 'h-1', action: 'key.created', changedAt: key.createdAt, changedBy: key.createdBy ?? 'Unknown', changedByEmail: 'admin@hato.com', changes: [] },
        { id: 'h-2', action: 'value.updated', changedAt: key.updatedAt, changedBy: 'Admin User', changedByEmail: 'admin@hato.com', changes: [{ fieldPath: 'TH', from: '(empty)', to: key.values.find(v => v.locale === 'th')?.value }] },
      ],
    })
  }),

  http.post(`${BASE}/keys`, async ({ request }) => {
    await delay(300)
    const body = await request.json() as { namespacePath: string; keyName: string; thValue?: string; enValue?: string; description?: string; tags?: string[]; platforms?: string[] }
    const newKey: TranslationKeyDTO = {
      id: `key-${Date.now()}`,
      namespaceId: mockNamespaces.find((ns) => ns.path === body.namespacePath)?.id ?? 'ns-1',
      namespacePath: body.namespacePath,
      keyName: body.keyName,
      fullKey: `${body.namespacePath}.${body.keyName}`,
      description: body.description ?? null,
      tags: body.tags ?? [],
      status: (body.thValue && body.enValue) ? 'TRANSLATED' as any : 'PENDING' as any,
      platforms: (body.platforms ?? []) as any,
      createdBy: 'Mock User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      values: [
        ...(body.thValue ? [{ id: `v-${Date.now()}-th`, locale: 'th' as any, value: body.thValue, version: 1, updatedBy: 'Mock User', updatedAt: new Date().toISOString() }] : []),
        ...(body.enValue ? [{ id: `v-${Date.now()}-en`, locale: 'en' as any, value: body.enValue, version: 1, updatedBy: 'Mock User', updatedAt: new Date().toISOString() }] : []),
      ],
    }
    keys = [...keys, newKey]
    return HttpResponse.json(newKey, { status: 201 })
  }),

  http.put(`${BASE}/keys/:id/save`, async ({ params, request }) => {
    await delay(250)
    const body = await request.json() as { th?: string; en?: string; tags?: string[] }
    const idx  = keys.findIndex((k) => k.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: { message: 'Key not found' } }, { status: 404 })

    const key     = { ...keys[idx] }
    const changes: { fieldPath: string; from: unknown; to: unknown }[] = []

    if (body.th !== undefined) {
      const existing = key.values.find((v) => v.locale === 'th')
      if (existing?.value !== body.th) {
        changes.push({ fieldPath: 'TH', from: existing?.value, to: body.th })
        key.values = key.values.filter((v) => v.locale !== 'th').concat({ id: `v-${Date.now()}`, locale: 'th' as any, value: body.th, version: (existing?.version ?? 0) + 1, updatedBy: 'Mock User', updatedAt: new Date().toISOString() })
      }
    }
    if (body.en !== undefined) {
      const existing = key.values.find((v) => v.locale === 'en')
      if (existing?.value !== body.en) {
        changes.push({ fieldPath: 'EN', from: existing?.value, to: body.en })
        key.values = key.values.filter((v) => v.locale !== 'en').concat({ id: `v-${Date.now()}`, locale: 'en' as any, value: body.en, version: (existing?.version ?? 0) + 1, updatedBy: 'Mock User', updatedAt: new Date().toISOString() })
      }
    }
    if (body.tags !== undefined) {
      changes.push({ fieldPath: 'tags', from: key.tags, to: body.tags })
      key.tags = body.tags
    }

    const thVal = key.values.find((v) => v.locale === 'th')?.value
    const enVal = key.values.find((v) => v.locale === 'en')?.value
    key.status  = (thVal && enVal) ? 'TRANSLATED' as any : 'PENDING' as any
    key.updatedAt = new Date().toISOString()

    keys = keys.map((k, i) => i === idx ? key : k)
    return HttpResponse.json({ status: 'updated', changes })
  }),

  http.delete(`${BASE}/keys/:id`, async ({ params }) => {
    await delay(200)
    keys = keys.filter((k) => k.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${BASE}/keys/bulk/delete`, async ({ request }) => {
    await delay(300)
    const body = await request.json() as { ids: string[] }
    keys = keys.filter((k) => !body.ids.includes(k.id))
    return HttpResponse.json({ deleted: body.ids.length })
  }),

  // ── Change Requests ───────────────────────────────────────────────────────

  http.get(`${BASE}/change-requests`, async ({ request }) => {
    await delay(200)
    const status = new URL(request.url).searchParams.get('status')
    const data   = status ? changeRequests.filter((cr) => cr.status === status) : changeRequests
    return HttpResponse.json(data)
  }),

  http.get(`${BASE}/change-requests/:id`, async ({ params }) => {
    await delay(150)
    const cr = changeRequests.find((c) => c.id === params.id)
    if (!cr) return HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })
    return HttpResponse.json(cr)
  }),

  http.post(`${BASE}/change-requests`, async ({ request }) => {
    await delay(300)
    const body = await request.json() as { title: string; reviewerIds: string[]; items: ChangeRequestDTO['items'] }
    const newCR: ChangeRequestDTO = {
      id: `cr-${Date.now()}`,
      title: body.title,
      status: 'pending' as any,
      authorId: 'user-1',
      authorName: 'Mock User',
      reviewerIds: body.reviewerIds,
      items: body.items.map((item, i) => ({ ...item, id: `item-new-${i}` })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    changeRequests = [...changeRequests, newCR]
    return HttpResponse.json(newCR, { status: 201 })
  }),

  http.put(`${BASE}/change-requests/:id/review`, async ({ params, request }) => {
    await delay(250)
    const body = await request.json() as { action: 'approve' | 'reject' | 'request-changes' }
    const idx  = changeRequests.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })

    const cr = { ...changeRequests[idx] }
    if (body.action === 'reject') cr.status = 'rejected' as any
    else if (body.action === 'approve') cr.status = 'approved' as any
    cr.updatedAt = new Date().toISOString()

    changeRequests = changeRequests.map((c, i) => i === idx ? cr : c)
    return HttpResponse.json(cr)
  }),

  http.put(`${BASE}/change-requests/:id/publish`, async ({ params }) => {
    await delay(400)
    const idx = changeRequests.findIndex((c) => c.id === params.id)
    if (idx === -1) return HttpResponse.json({ error: { message: 'Not found' } }, { status: 404 })

    const cr = { ...changeRequests[idx], status: 'published' as any, updatedAt: new Date().toISOString() }
    changeRequests = changeRequests.map((c, i) => i === idx ? cr : c)
    return HttpResponse.json(cr)
  }),

  // ── Import / Export ───────────────────────────────────────────────────────

  http.post(`${BASE}/import-export/import/json`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as { confirm?: boolean }
    if (!body.confirm) return HttpResponse.json(mockImportPreview)
    return HttpResponse.json({ imported: mockImportPreview.added.length + mockImportPreview.modified.length })
  }),

  http.post(`${BASE}/import-export/import/csv`, async ({ request }) => {
    await delay(400)
    const body = await request.json() as { confirm?: boolean }
    if (!body.confirm) return HttpResponse.json(mockImportPreview)
    return HttpResponse.json({ imported: mockImportPreview.added.length + mockImportPreview.modified.length })
  }),

  http.get(`${BASE}/import-export/export/json`, async () => {
    await delay(300)
    const data = JSON.stringify({ 'liff.dinein.confirmButton': 'ยืนยัน', 'liff.dinein.cancelButton': 'ยกเลิก' }, null, 2)
    return new HttpResponse(data, {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="export.json"' },
    })
  }),

  http.get(`${BASE}/import-export/export/csv`, async () => {
    await delay(300)
    const csv = `"key","TH","EN","description"\n"liff.dinein.confirmButton","ยืนยัน","Confirm","Confirm order button"\n"liff.dinein.cancelButton","ยกเลิก","Cancel","Cancel order button"`
    return new HttpResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="export.csv"' },
    })
  }),
]
