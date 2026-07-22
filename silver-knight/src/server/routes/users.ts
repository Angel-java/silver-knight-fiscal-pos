import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'
import { authMiddleware, gerenteOrAdminMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createUserSchema, updateUserSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { ADMIN_USERNAME } from '../auth/autoAdmin'
import { parsePermissions } from '../utils/parsePermissions'

const router = Router()
router.use(authMiddleware)
router.use(gerenteOrAdminMiddleware)

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
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { username: { not: ADMIN_USERNAME } },
      select: userSelect,
      orderBy: { createdAt: 'asc' }
    })
    const mapped = users.map((u) => ({
      ...u,
      permissions: parsePermissions(u.permissions)
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

    if (requestingRole === 'gerente' && role !== 'operador') {
      res.status(403).json({ error: 'Los gerentes solo pueden crear usuarios con rol operador' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(409).json({ error: 'El nombre de usuario ya existe' })
      return
    }
    const hashedPin = await bcrypt.hash(pin, 10)
    const user = await prisma.user.create({
      data: {
        username,
        fullName: fullName || null,
        pin: hashedPin,
        role: role || 'operador',
        permissions: permissions ? JSON.stringify(permissions) : null
      },
      select: userSelect
    })
    res.status(201).json({
      user: { ...user, permissions: parsePermissions(user.permissions) }
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

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    if (existing.username === ADMIN_USERNAME) {
      res.status(403).json({ error: 'No se puede modificar el usuario administrador del sistema' })
      return
    }

    if (requestingRole === 'gerente' && existing.role !== 'operador') {
      res
        .status(403)
        .json({ error: 'Los gerentes solo pueden modificar usuarios con rol operador' })
      return
    }

    if (requestingRole === 'gerente' && role && role !== 'operador') {
      res
        .status(403)
        .json({ error: 'Los gerentes no pueden cambiar el rol de un usuario a admin o gerente' })
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
    if (permissions !== undefined) data.permissions = permissions ? JSON.stringify(permissions) : null
    if (pin) data.pin = await bcrypt.hash(pin, 10)

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect
    })
    res.json({
      user: { ...user, permissions: parsePermissions(user.permissions) }
    })
  })
)

export default router
