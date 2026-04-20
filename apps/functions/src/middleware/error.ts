import type { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { message: err.message } })
    return
  }

  // Firebase Auth errors
  if (err instanceof Error && err.message.includes('Firebase ID token')) {
    res.status(401).json({ error: { message: 'Invalid or expired token' } })
    return
  }

  console.error('[functions] Unhandled error:', err)
  res.status(500).json({ error: { message: 'Internal server error' } })
}
