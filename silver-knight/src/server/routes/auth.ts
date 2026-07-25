import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { prisma } from '../database/prisma'
import { generateToken, authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { loginSchema, setupSchema, updateCompanySchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { ROOT_USERNAME } from '../auth/autoAdmin'
import { parsePermissions } from '../utils/parsePermissions'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
})

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de configuración. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false
})

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, pin } = req.body
    if (!username || !pin) {
      res.status(400).json({ error: 'Username y PIN requeridos' })
      return
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' })
      return
    }
    if (!user.isActive) {
      res.status(401).json({ error: 'Usuario desactivado. Contacta al administrador.' })
      return
    }

    console.log(`[DEBUG LOGIN] User: ${user.username}, pin input type=${typeof pin}, length=${pin.length}`)
    console.log(`[DEBUG LOGIN] Stored pin hash starts with: ${user.pin?.substring(0, 10)}... (length=${user.pin?.length})`)
    const valid = await bcrypt.compare(pin, user.pin)
    console.log(`[DEBUG LOGIN] bcrypt.compare result: ${valid}`)
    if (!valid) {
      res.status(401).json({ error: 'PIN incorrecto' })
      return
    }

    const token = await generateToken({ userId: user.id, username: user.username, role: user.role })
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        permissions: parsePermissions(user.permissions)
      }
    })
  })
)

router.post(
  '/setup',
  setupLimiter,
  validate(setupSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const nonRootUsers = await prisma.user.count({
      where: { username: { not: ROOT_USERNAME } }
    })
    if (nonRootUsers > 0) {
      res.status(400).json({ error: 'El sistema ya está configurado' })
      return
    }

    const { profile, company, adminUser } = req.body

    const hashedPin = await bcrypt.hash(adminUser.pin, 10)
    const adminFullName = adminUser.fullName || null

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
          fullName: adminFullName,
          pin: hashedPin,
          role: 'admin'
        }
      })

      await tx.setting.upsert({
        where: { key: 'profile' },
        update: { value: profile },
        create: { key: 'profile', value: profile }
      })

      return {
        company: newCompany,
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.fullName,
          role: newUser.role,
          permissions: null
        }
      }
    })

    const token = await generateToken({
      userId: result.user.id,
      username: result.user.username,
      role: result.user.role
    })
    res.status(201).json({ token, user: result.user, company: result.company })
  })
)

router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, username: true, fullName: true, role: true, permissions: true }
    })
    if (!dbUser) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    res.json({
      user: {
        ...dbUser,
        permissions: parsePermissions(dbUser.permissions)
      }
    })
  })
)

router.get(
  '/company',
  asyncHandler(async (_req: Request, res: Response) => {
    const company = await prisma.company.findFirst()
    res.json({ company })
  })
)

router.put(
  '/company',
  authMiddleware,
  requirePermission('settings'),
  validate(updateCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
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
  })
)

export default router
