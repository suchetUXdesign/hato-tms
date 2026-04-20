import express from 'express'
import cors from 'cors'
import { bindRepositories } from './container'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'

import keysRouter          from './routes/keys'
import namespacesRouter    from './routes/namespaces'
import changeRequestsRouter from './routes/changeRequests'
import importExportRouter  from './routes/importExport'
import coverageRouter      from './routes/coverage'
import usersRouter         from './routes/users'
import authRouter          from './routes/auth'

export function createApp(): express.Application {
  // Bind repository implementations (Firestore by default)
  bindRepositories()

  const app = express()

  // ---- Global Middleware ----
  app.use(
    cors({
      origin: true,   // reflect origin — supports Figma's null origin
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Token'],
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '10mb' }))

  // ---- Health Check (unauthenticated) ----
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ---- Auth routes (login handled by Firebase Auth on client) ----
  app.use('/api/v1/auth', authRouter)

  // ---- Protected routes ----
  app.use('/api/v1', authMiddleware)
  app.use('/api/v1/keys',            keysRouter)
  app.use('/api/v1/namespaces',      namespacesRouter)
  app.use('/api/v1/change-requests', changeRequestsRouter)
  app.use('/api/v1/import-export',   importExportRouter)
  app.use('/api/v1/coverage',        coverageRouter)
  app.use('/api/v1/users',           usersRouter)

  // ---- 404 ----
  app.use((_req, res) => {
    res.status(404).json({ error: { message: 'Route not found' } })
  })

  // ---- Global Error Handler ----
  app.use(errorHandler)

  return app
}
