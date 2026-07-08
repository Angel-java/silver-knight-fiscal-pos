import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCustomerSchema, updateCustomerSchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('customers'))

router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || ''
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = 20
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
  } catch (error) {
    logger.error('customers', 'list error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    logger.error('customers', 'get error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', validate(createCustomerSchema), async (req: Request, res: Response) => {
  try {
    const { name, rif, address, phone, email, creditLimitUsd, creditLimitVes } = req.body

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        rif: rif || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        creditLimitUsd: creditLimitUsd != null ? parseFloat(creditLimitUsd) : null,
        creditLimitVes: creditLimitVes != null ? parseFloat(creditLimitVes) : null
      }
    })
    res.status(201).json({ customer })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code: string; meta?: { target?: string[] } }
      if (e.code === 'P2002') {
        const field = e.meta?.target?.[0] || 'campo'
        res.status(409).json({ error: `Ya existe un cliente con ese ${field}` })
        return
      }
    }
    logger.error('customers', 'create error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', validate(updateCustomerSchema), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, rif, address, phone, email, creditLimitUsd, creditLimitVes } = req.body

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name.trim(),
        rif: rif ?? null,
        address: address ?? null,
        phone: phone ?? null,
        email: email ?? null,
        creditLimitUsd: creditLimitUsd != null ? parseFloat(creditLimitUsd) : null,
        creditLimitVes: creditLimitVes != null ? parseFloat(creditLimitVes) : null
      }
    })
    res.json({ customer })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'P2002') {
        res.status(409).json({ error: 'Ya existe un cliente con ese RIF' })
        return
      }
      if (e.code === 'P2025') {
        res.status(404).json({ error: 'Cliente no encontrado' })
        return
      }
    }
    logger.error('customers', 'update error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const invoiceCount = await prisma.invoice.count({ where: { customerId: id } })
    if (invoiceCount > 0) {
      res.status(400).json({ error: 'No se puede eliminar un cliente con facturas asociadas' })
      return
    }
    await prisma.customer.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Cliente no encontrado' })
      return
    }
    logger.error('customers', 'delete error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
