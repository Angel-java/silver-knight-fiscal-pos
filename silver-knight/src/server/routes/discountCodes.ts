import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { asyncHandler, AppError } from '../middleware/errorHandler'
import {
  discountCodeSchema,
  generateDiscountCodeSchema,
  validateDiscountCodeSchema
} from '../validation/schemas'
import { z } from 'zod'
import { generateUniqueDiscountCode, validateDiscountCode } from '../utils/discounts'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('discount-codes'))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string) || ''
  const isActive = req.query.isActive as string | undefined
  const expired = req.query.expired as string | undefined
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { deletedAt: null }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ]
  }
  if (isActive === 'true') where.isActive = true
  if (isActive === 'false') where.isActive = false

  if (expired === 'true') {
    where.validUntil = { lt: new Date() }
  } else if (expired === 'false') {
    where.OR = [{ validUntil: { gte: new Date() } }, { validUntil: null }]
  }

  const [codes, total] = await Promise.all([
    prisma.discountCode.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { createdBy: { select: { username: true, fullName: true } } }
    }),
    prisma.discountCode.count({ where })
  ])

  res.json({ codes, total, page, pages: Math.ceil(total / limit) })
}))

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const code = await prisma.discountCode.findUnique({
    where: { id, deletedAt: null },
    include: { createdBy: { select: { username: true, fullName: true } } }
  })
  if (!code) {
    res.status(404).json({ error: 'Código no encontrado' })
    return
  }
  res.json({ code })
}))

router.post('/generate', validate(generateDiscountCodeSchema), asyncHandler(async (req: Request, res: Response) => {
  const { prefix, length, separator, groups } = req.body
  const code = await generateUniqueDiscountCode(prefix, length, separator, groups)
  res.json({ code })
}))

router.post('/', validate(discountCodeSchema), asyncHandler(async (req: Request, res: Response) => {
  const data = req.body
  const code = data.code
    ? data.code.trim().toUpperCase()
    : await generateUniqueDiscountCode()

  const existing = await prisma.discountCode.findUnique({ where: { code } })
  if (existing) {
    throw new AppError(409, `Ya existe un código con el nombre "${code}"`)
  }

  const created = await prisma.discountCode.create({
    data: {
      code,
      description: data.description || null,
      discountValue: Number(data.discountValue),
      validFrom: data.validFrom || null,
      validUntil: data.validUntil || null,
      minSubtotal: data.minSubtotal ?? null,
      minQuantity: data.minQuantity ?? null,
      currency: data.currency,
      isActive: data.isActive,
      usageLimit: data.usageLimit ?? null,
      usagePerCustomer: data.usagePerCustomer ?? null,
      requireCustomer: data.requireCustomer,
      scope: data.scope,
      productIds: data.productIds || null,
      categoryIds: data.categoryIds || null,
      maxDiscountAmount: data.maxDiscountAmount ?? null,
      createdById: req.user?.userId || null
    }
  })

  res.status(201).json({ code: created })
}))

const updateDiscountCodeSchema = z.object({
  description: z.string().trim().max(255).optional().nullable(),
  discountValue: z.coerce.number().min(1).max(100).optional(),
  validFrom: z.coerce.date().optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
  minSubtotal: z.coerce.number().min(0).optional().nullable(),
  minQuantity: z.coerce.number().int().positive().optional().nullable(),
  currency: z.enum(['USD', 'VES']).optional(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  usagePerCustomer: z.coerce.number().int().positive().optional().nullable(),
  requireCustomer: z.boolean().optional(),
  scope: z.enum(['ALL', 'PRODUCTS', 'CATEGORIES']).optional(),
  productIds: z.array(z.string()).optional().nullable(),
  categoryIds: z.array(z.string()).optional().nullable(),
  maxDiscountAmount: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional()
}).refine(
  (data) => !data.validFrom || !data.validUntil || data.validUntil >= data.validFrom,
  { message: 'Válido Hasta debe ser mayor o igual a Válido Desde', path: ['validUntil'] }
)

router.patch('/:id', validate(updateDiscountCodeSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const data = req.body

  const existing = await prisma.discountCode.findUnique({ where: { id, deletedAt: null } })
  if (!existing) {
    res.status(404).json({ error: 'Código no encontrado' })
    return
  }

  if (data.validFrom && data.validUntil && new Date(data.validUntil) < new Date(data.validFrom)) {
    throw new AppError(400, 'Válido Hasta debe ser mayor o igual a Válido Desde')
  }

  const updateData: Record<string, unknown> = {}
  if (data.description !== undefined) updateData.description = data.description
  if (data.discountValue !== undefined) updateData.discountValue = Number(data.discountValue)
  if (data.validFrom !== undefined) updateData.validFrom = data.validFrom
  if (data.validUntil !== undefined) updateData.validUntil = data.validUntil
  if (data.minSubtotal !== undefined) updateData.minSubtotal = data.minSubtotal
  if (data.minQuantity !== undefined) updateData.minQuantity = data.minQuantity
  if (data.currency !== undefined) updateData.currency = data.currency
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.usageLimit !== undefined) updateData.usageLimit = data.usageLimit
  if (data.usagePerCustomer !== undefined) updateData.usagePerCustomer = data.usagePerCustomer
  if (data.requireCustomer !== undefined) updateData.requireCustomer = data.requireCustomer
  if (data.scope !== undefined) updateData.scope = data.scope
  if (data.productIds !== undefined) updateData.productIds = data.productIds
  if (data.categoryIds !== undefined) updateData.categoryIds = data.categoryIds
  if (data.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = data.maxDiscountAmount

  const updated = await prisma.discountCode.update({
    where: { id },
    data: updateData
  })

  res.json({ code: updated })
}))

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const existing = await prisma.discountCode.findUnique({ where: { id, deletedAt: null } })
  if (!existing) {
    res.status(404).json({ error: 'Código no encontrado' })
    return
  }

  const hasInvoices = await prisma.invoice.count({ where: { discountCodeId: id } })
  if (hasInvoices > 0) {
    // Soft delete si ya fue usado
    const updated = await prisma.discountCode.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() }
    })
    res.json({ code: updated, softDeleted: true })
    return
  }

  await prisma.discountCode.delete({ where: { id } })
  res.json({ ok: true })
}))

router.post('/validate', validate(validateDiscountCodeSchema), asyncHandler(async (req: Request, res: Response) => {
  const result = await validateDiscountCode(req.body)
  res.json({ valid: true, ...result })
}))

export default router
