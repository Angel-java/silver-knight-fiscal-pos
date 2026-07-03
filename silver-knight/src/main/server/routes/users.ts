import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    })
    res.json({ users })
  } catch (error) {
    console.error('[users] list error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, pin, role } = req.body
    if (!username || !pin) {
      res.status(400).json({ error: 'Username y PIN requeridos' })
      return
    }
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      res.status(409).json({ error: 'El nombre de usuario ya existe' })
      return
    }
    const hashedPin = await bcrypt.hash(pin, 10)
    const user = await prisma.user.create({
      data: { username, pin: hashedPin, role: role || 'operator' },
      select: { id: true, username: true, role: true, isActive: true, createdAt: true }
    })
    res.status(201).json({ user })
  } catch (error) {
    console.error('[users] create error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { username, pin, role, isActive } = req.body
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: 'Usuario no encontrado' })
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
    if (role) data.role = role
    if (typeof isActive === 'boolean') data.isActive = isActive
    if (pin) data.pin = await bcrypt.hash(pin, 10)
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, isActive: true, createdAt: true }
    })
    res.json({ user })
  } catch (error) {
    console.error('[users] update error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
