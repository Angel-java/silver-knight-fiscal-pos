import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../../database/prisma'
import { generateToken, authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, pin } = req.body
    if (!username || !pin) {
      res.status(400).json({ error: 'Username y PIN requeridos' })
      return
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const valid = await bcrypt.compare(pin, user.pin)
    if (!valid) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }

    const token = generateToken({ userId: user.id, username: user.username, role: user.role })
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
  } catch (error) {
    console.error('[auth] login error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/setup', async (req: Request, res: Response) => {
  try {
    const existingUsers = await prisma.user.count()
    if (existingUsers > 0) {
      res.status(400).json({ error: 'El sistema ya está configurado' })
      return
    }

    const { company, adminUser } = req.body
    if (!company?.name || !company?.rif || !adminUser?.username || !adminUser?.pin) {
      res.status(400).json({ error: 'Datos incompletos: company (name, rif) y adminUser (username, pin) requeridos' })
      return
    }

    const hashedPin = await bcrypt.hash(adminUser.pin, 10)

    const result = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name: company.name,
          rif: company.rif,
          address: company.address || null,
          phone: company.phone || null,
          email: company.email || null
        }
      })

      const newUser = await tx.user.create({
        data: {
          username: adminUser.username,
          pin: hashedPin,
          role: 'admin'
        }
      })

      return { company: newCompany, user: { id: newUser.id, username: newUser.username, role: newUser.role } }
    })

    const token = generateToken({ userId: result.user.id, username: result.user.username, role: result.user.role })
    res.status(201).json({ token, user: result.user, company: result.company })
  } catch (error) {
    console.error('[auth] setup error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!
    const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, username: true, role: true } })
    if (!dbUser) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    res.json({ user: dbUser })
  } catch (error) {
    console.error('[auth] me error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/company', async (_req: Request, res: Response) => {
  try {
    const company = await prisma.company.findFirst()
    res.json({ company })
  } catch (error) {
    console.error('[auth] company error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
