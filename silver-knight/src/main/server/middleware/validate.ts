import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (result.success) {
      req.body = result.data
      next()
    } else {
      const firstIssue = result.error.issues[0]
      const message = firstIssue
        ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
        : 'Datos inválidos'
      res.status(400).json({ error: message })
    }
  }
}
