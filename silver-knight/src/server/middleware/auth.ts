import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { prisma } from '../database/prisma'
import { resolvePermissions } from '../utils/parsePermissions'

let cachedSecret: string | null = null

async function resolveJwtSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret
  const envSecret = process.env['JWT_SECRET']
  if (envSecret) {
    cachedSecret = envSecret
    return envSecret
  }
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'jwtSecret' } })
    if (row) {
      cachedSecret = row.value
      return row.value
    }
  } catch {
    // DB not ready yet (first run); fall through to generating
  }
  const generated = crypto.randomBytes(32).toString('hex')
  try {
    await prisma.setting.upsert({
      where: { key: 'jwtSecret' },
      update: { value: generated },
      create: { key: 'jwtSecret', value: generated }
    })
  } catch {
    // DB not ready; use generated for this session
  }
  cachedSecret = generated
  return generated
}

export interface AuthPayload {
  userId: string
  username: string
  role: string
}

export async function generateToken(payload: AuthPayload): Promise<string> {
  const secret = await resolveJwtSecret()
  return jwt.sign(payload, secret, { expiresIn: '24h' })
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  try {
    const token = header.slice(7)
    const secret = await resolveJwtSecret()
    const payload = jwt.verify(token, secret) as AuthPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export function rootMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'root') {
    res.status(403).json({ error: 'Acción solo permitida para el propietario del sistema' })
    return
  }
  next()
}

export function rootOrAdminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const role = req.user?.role
  if (role !== 'root' && role !== 'admin') {
    res.status(403).json({ error: 'Acción solo permitida para root o administradores' })
    return
  }
  next()
}

export function requirePermission(module: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const role = req.user?.role
    // Root siempre tiene acceso total
    if (role === 'root') {
      next()
      return
    }
    // Admin, gerente y operador: verificar permisos del array
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user?.userId },
        select: { permissions: true, role: true }
      })
      if (!user) {
        res.status(403).json({ error: 'No tienes permiso para acceder a este módulo' })
        return
      }
      const perms = resolvePermissions(user.permissions, user.role)
      if (!perms.includes(module)) {
        res.status(403).json({ error: 'No tienes permiso para acceder a este módulo' })
        return
      }
      next()
    } catch {
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
}
