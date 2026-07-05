import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { prisma } from '../../database/prisma'
import { generateToken, authMiddleware, adminMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { loginSchema, setupSchema, updateCompanySchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})

router.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
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

    const token = await generateToken({ userId: user.id, username: user.username, role: user.role })
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
  } catch (error) {
    logger.error('auth', 'login error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/setup', validate(setupSchema), async (req: Request, res: Response) => {
  try {
    const existingUsers = await prisma.user.count()
    if (existingUsers > 0) {
      res.status(400).json({ error: 'El sistema ya está configurado' })
      return
    }

    const { company, adminUser } = req.body

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

      return {
        company: newCompany,
        user: { id: newUser.id, username: newUser.username, role: newUser.role }
      }
    })

    const token = await generateToken({
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role
    })
    res.status(201).json({ token, user: result.user, company: result.company })
  } catch (error) {
    logger.error('auth', 'setup error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, username: true, role: true }
    })
    if (!dbUser) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    res.json({ user: dbUser })
  } catch (error) {
    logger.error('auth', 'me error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/company', async (_req: Request, res: Response) => {
  try {
    const company = await prisma.company.findFirst()
    res.json({ company })
  } catch (error) {
    logger.error('auth', 'company error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put(
  '/company',
  authMiddleware,
  adminMiddleware,
  validate(updateCompanySchema),
  async (req: Request, res: Response) => {
    try {
      const { name, rif, address, phone, email } = req.body
      const existing = await prisma.company.findFirst()
      if (!existing) {
        res.status(404).json({ error: 'Empresa no encontrada' })
        return
      }
      const dupRif = await prisma.company.findFirst({ where: { rif, id: { not: existing.id } } })
      if (dupRif) {
        res.status(409).json({ error: 'Ya existe otra empresa con ese RIF' })
        return
      }
      const company = await prisma.company.update({
        where: { id: existing.id },
        data: { name, rif, address: address || null, phone: phone || null, email: email || null }
      })
      res.json({ company })
    } catch (error) {
      logger.error('auth', 'company update error', error)
      res.status(500).json({ error: 'Error interno del servidor' })
    }
  }
)

export default router
