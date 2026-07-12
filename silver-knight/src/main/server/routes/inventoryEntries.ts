import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createInventoryEntrySchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('inventory-entries'))

router.get('/', async (req: Request, res: Response) => {
  try {
    const productId = req.query.productId as string | undefined
    const type = req.query.type as string | undefined
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = 50
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (type) where.type = type
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter['gte'] = new Date(from)
      if (to) {
        const end = new Date(to)
        end.setHours(23, 59, 59, 999)
        dateFilter['lte'] = end
      }
      where.createdAt = dateFilter
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, code: true, costUsd: true, costVes: true, priceUsd: true, priceVes: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.inventoryMovement.count({ where })
    ])

    res.json({ movements, total, page, pages: Math.ceil(total / limit) })
  } catch (error) {
    logger.error('inventory-entries', 'list error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', validate(createInventoryEntrySchema), async (req: Request, res: Response) => {
  try {
    const { productId, type, quantity, unitCostUsd, unitCostVes, reference, notes } = req.body
    const userId = req.user?.userId || null

    const product = await prisma.product.findUnique({ where: { id: productId } })
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado' })
      return
    }

    const delta = type === 'entry' ? parseFloat(quantity) : -parseFloat(quantity)
    const newStock = product.stock + delta
    if (newStock < 0) {
      res.status(400).json({ error: 'Stock insuficiente' })
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: newStock },
        include: { category: { select: { id: true, name: true } } }
      })

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type,
          quantity: parseFloat(quantity),
          unitCostUsd: unitCostUsd != null ? parseFloat(unitCostUsd) : null,
          unitCostVes: unitCostVes != null ? parseFloat(unitCostVes) : null,
          reference: reference || null,
          notes: notes || null,
          userId
        }
      })

      return { product: updated, movement }
    })

    res.status(201).json(result)
  } catch (error) {
    logger.error('inventory-entries', 'create error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
