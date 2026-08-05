import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCustomerSchema, updateCustomerSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { DEFAULT_PAGE_SIZE } from '../config'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('customers'))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string) || ''
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = DEFAULT_PAGE_SIZE
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { rif: { contains: search } },
      { phone: { contains: search } }
    ]
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit
    }),
    prisma.customer.count({ where })
  ])

  res.json({ customers, total, page, pages: Math.ceil(total / limit) })
}))

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { items: true }
      }
    }
  })
  if (!customer) {
    res.status(404).json({ error: 'Cliente no encontrado' })
    return
  }
  res.json({ customer })
}))

router.post('/', validate(createCustomerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, rif, address, phone, email, creditLimitUsd } = req.body

  const customer = await prisma.customer.create({
    data: {
      name: name.trim(),
      rif: rif || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      creditLimitUsd: creditLimitUsd != null ? parseFloat(creditLimitUsd) : null
    }
  })
  res.status(201).json({ customer })
}))

router.put('/:id', validate(updateCustomerSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { name, rif, address, phone, email, creditLimitUsd } = req.body

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      name: name.trim(),
      rif: rif ?? null,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      creditLimitUsd: creditLimitUsd != null ? parseFloat(creditLimitUsd) : null
    }
  })
  res.json({ customer })
}))

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const invoiceCount = await prisma.invoice.count({ where: { customerId: id } })
  if (invoiceCount > 0) {
    res.status(400).json({ error: 'No se puede eliminar un cliente con facturas asociadas' })
    return
  }
  await prisma.customer.delete({ where: { id } })
  res.json({ ok: true })
}))

export default router
