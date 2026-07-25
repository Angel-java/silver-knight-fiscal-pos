import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../database/prisma'
import { authMiddleware, rootOrAdminMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createUserSchema, updateUserSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { ROOT_USERNAME } from '../auth/autoAdmin'
import { parsePermissions } from '../utils/parsePermissions'

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
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
      where: { username: { not: ROOT_USERNAME } },
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

    // Root puede crear cualquier rol
    // Admin solo puede crear gerente y operador
    // Gerente no debería llegar aquí (middleware lo bloquea)
    if (requestingRole === 'admin' && role !== 'gerente' && role !== 'operador') {
      res.status(403).json({ error: 'Los administradores solo pueden crear gerentes u operadores' })
      return
    }

    // Verificar que no se intente crear otro root
    if (role === 'root') {
      res.status(403).json({ error: 'No se puede crear otro usuario root' })
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
    const requestingUserId = req.user?.userId

    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }

    // Root no se puede editar por nadie
    if (existing.username === ROOT_USERNAME) {
      res.status(403).json({ error: 'No se puede modificar al propietario del sistema' })
      return
    }

    // Un usuario no puede editarse a sí mismo
    if (id === requestingUserId) {
      res.status(403).json({ error: 'No puedes editar tu propio perfil desde esta sección' })
      return
    }

    // Admin solo puede modificar gerentes y operadores
    if (requestingRole === 'admin' && existing.role !== 'gerente' && existing.role !== 'operador') {
      res.status(403).json({ error: 'Los administradores solo pueden modificar gerentes u operadores' })
      return
    }

    // Admin no puede cambiar un usuario a root
    if (role === 'root') {
      res.status(403).json({ error: 'No se puede asignar el rol root a un usuario' })
      return
    }

    // Admin no puede cambiar el rol de gerente a admin (solo root puede)
    if (requestingRole === 'admin' && role === 'admin' && existing.role !== 'admin') {
      res.status(403).json({ error: 'Solo root puede asignar el rol admin' })
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
      const hasExistingPerms = existing.permissions && parsePermissions(existing.permissions)
      const incomingEmpty = Array.isArray(permissions) && permissions.length === 0
      if (incomingEmpty && hasExistingPerms) {
        // No sobrescribir — mantener permisos existentes del usuario
      } else {
        data.permissions = permissions.length > 0 ? JSON.stringify(permissions) : null
      }
    }
    if (pin) {
      console.log(`[DEBUG UPDATE] Updating user ${id}: pin input length=${pin.length}, type=${typeof pin}`)
      const hashed = await bcrypt.hash(pin, 10)
      console.log(`[DEBUG UPDATE] Hashed pin: ${hashed.substring(0, 10)}... (length=${hashed.length})`)
      data.pin = hashed
    }

    console.log(`[DEBUG UPDATE] Prisma update data keys: ${Object.keys(data)}`)
    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect
    })
    console.log(`[DEBUG UPDATE] Updated user ${user.username} successfully`)
    res.json({
      user: { ...user, permissions: parsePermissions(user.permissions) }
    })
  })
)

export default router
