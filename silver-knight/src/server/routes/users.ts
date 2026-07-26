import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'
import { authMiddleware, rootOrAdminMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createUserSchema, updateUserSchema, permissionModules } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { ROOT_USERNAME } from '../auth/autoAdmin'
import { resolvePermissions } from '../utils/parsePermissions'

const router = Router()
router.use(authMiddleware)
router.use(rootOrAdminMiddleware)

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  permissions: true,
  isActive: true,
  createdAt: true
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const requestingRole = req.user?.role

    const where: Record<string, unknown> = { username: { not: ROOT_USERNAME } }

    if (requestingRole === 'admin') {
      where.role = { in: ['gerente', 'operador'] }
    }

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'asc' }
    })
    const mapped = users.map((u) => ({
      ...u,
      permissions: resolvePermissions(u.permissions, u.role)
    }))
    res.json({ users: mapped })
  })
)

router.post(
  '/',
  validate(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, fullName, pin, role, permissions } = req.body
    const requestingRole = req.user?.role

    if (role === 'root') {
      res.status(403).json({ error: 'No se puede crear otro usuario root' })
      return
    }

    if (requestingRole === 'admin' && role !== 'gerente' && role !== 'operador') {
      res.status(403).json({ error: 'Los administradores solo pueden crear gerentes u operadores' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(409).json({ error: 'El nombre de usuario ya existe' })
      return
    }

    const hashedPin = await bcrypt.hash(pin, 10)
    const finalPermissions = permissions && permissions.length > 0
      ? permissions
      : [...permissionModules]

    const user = await prisma.user.create({
      data: {
        username,
        fullName: fullName || null,
        pin: hashedPin,
        role: role || 'operador',
        permissions: JSON.stringify(finalPermissions)
      },
      select: userSelect
    })
    res.status(201).json({
      user: { ...user, permissions: resolvePermissions(user.permissions, user.role) }
    })
  })
)

router.put(
  '/:id',
  validate(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id)
    const { username, fullName, pin, role, isActive, permissions } = req.body
    const requestingRole = req.user?.role
    const requestingUserId = req.user?.userId

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    if (existing.username === ROOT_USERNAME) {
      res.status(403).json({ error: 'No se puede modificar al propietario del sistema' })
      return
    }

    if (id === requestingUserId) {
      res.status(403).json({ error: 'No puedes editar tu propio perfil desde esta sección' })
      return
    }

    if (requestingRole === 'admin') {
      if (existing.role === 'admin') {
        res.status(403).json({ error: 'Solo root puede modificar administradores' })
        return
      }
      if (role === 'admin') {
        res.status(403).json({ error: 'Solo root puede asignar el rol admin' })
        return
      }
    }

    if (role === 'root') {
      res.status(403).json({ error: 'No se puede asignar el rol root a un usuario' })
      return
    }

    if (username && username !== existing.username) {
      const dup = await prisma.user.findUnique({ where: { username } })
      if (dup) {
        res.status(409).json({ error: 'El nombre de usuario ya existe' })
        return
      }
    }

    const data: Record<string, unknown> = {}
    if (username) data.username = username
    if (fullName !== undefined) data.fullName = fullName || null
    if (role) data.role = role
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (permissions !== undefined) {
      data.permissions = permissions.length > 0 ? JSON.stringify(permissions) : null
    }
    if (pin) {
      data.pin = await bcrypt.hash(pin, 10)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect
    })
    res.json({
      user: { ...user, permissions: resolvePermissions(user.permissions, user.role) }
    })
  })
)

export default router
