import type { Request, Response, NextFunction } from 'express'
import { getAuth } from 'firebase-admin/auth'
import { getUserRepository } from '../container'
import { AppError } from './error'

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string
        email: string
        name: string
        role: string
        isActive: boolean
      }
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userRepo = getUserRepository()

    // ---- X-API-Token (CLI / Figma plugin) ----
    const apiToken = req.headers['x-api-token'] as string | undefined
    if (apiToken) {
      const user = await userRepo.findByApiToken(apiToken)
      if (!user) throw new AppError('Invalid API token', 401)
      if (!(user as any).isActive) throw new AppError('Account deactivated', 403)
      req.user = { id: user.id, email: user.email, name: user.name, role: user.role, isActive: true }
      return next()
    }

    // ---- Firebase ID Token (web UI) ----
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Missing authorization header', 401)
    }

    const idToken  = authHeader.split('Bearer ')[1]!
    const decoded  = await getAuth().verifyIdToken(idToken)
    const user     = await userRepo.findById(decoded.uid)

    if (!user) throw new AppError('User not found — please complete sign-up', 404)
    if (!(user as any).isActive) throw new AppError('Account deactivated', 403)

    req.user = { id: decoded.uid, email: user.email, name: user.name, role: user.role, isActive: true }
    next()
  } catch (err) {
    next(err)
  }
}

/** Role guard — use after authMiddleware */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError(`Required role: ${roles.join(' or ')}`, 403))
    }
    next()
  }
}
