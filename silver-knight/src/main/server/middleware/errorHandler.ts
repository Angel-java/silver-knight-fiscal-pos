import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details })
    return
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const e = err as { code: string; meta?: { target?: string[] } }
    if (e.code === 'P2002') {
      const field = e.meta?.target?.[0] || 'campo'
      res.status(409).json({ error: `Ya existe un registro con ese ${field}` })
      return
    }
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' })
      return
    }
    if (e.code === 'P2003') {
      res.status(400).json({ error: 'El registro está en uso por otros datos' })
      return
    }
  }

  console.error('[error]', err)
  res.status(500).json({ error: 'Error interno del servidor' })
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
