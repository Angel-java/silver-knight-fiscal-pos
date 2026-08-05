import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createProductSchema, updateProductSchema, stockAdjustSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'
import { DEFAULT_PAGE_SIZE, DEFAULT_IVA_RATE } from '../config'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('products'))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string) || ''
  const categoryId = req.query.category as string | undefined
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = DEFAULT_PAGE_SIZE
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { code: { contains: search } },
      { barcode: { contains: search } }
    ]
  }
  if (categoryId) where.categoryId = categoryId

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' },
      skip,
      take: limit
    }),
    prisma.product.count({ where })
  ])

  res.json({ products, total, page, pages: Math.ceil(total / limit) })
}))

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } }
    }
  })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }
  res.json({ product })
}))

router.post('/', validate(createProductSchema), asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    code,
    barcode,
    description,
    priceUsd,
    costUsd,
    ivaRate,
    stock,
    minStock,
    categoryId,
    supplierId
  } = req.body

  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      code: code || null,
      barcode: barcode || null,
      description: description || null,
      priceUsd: parseFloat(priceUsd),
      costUsd: costUsd != null ? parseFloat(costUsd) : null,
      ivaRate: parseFloat(ivaRate) || DEFAULT_IVA_RATE,
      stock: parseFloat(stock) || 0,
      minStock: parseFloat(minStock) || 0,
      categoryId: categoryId || null,
      supplierId: supplierId || null
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } }
    }
  })
  res.status(201).json({ product })
}))

router.put('/:id', validate(updateProductSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const {
    name,
    code,
    barcode,
    description,
    priceUsd,
    costUsd,
    ivaRate,
    stock,
    minStock,
    categoryId,
    supplierId,
    isActive
  } = req.body

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name.trim(),
      code: code ?? null,
      barcode: barcode ?? null,
      description: description ?? null,
      priceUsd: parseFloat(priceUsd),
      costUsd: costUsd != null ? parseFloat(costUsd) : null,
      ivaRate: parseFloat(ivaRate) || DEFAULT_IVA_RATE,
      stock: stock != null ? parseFloat(stock) : undefined,
      minStock: parseFloat(minStock) || 0,
      categoryId: categoryId ?? null,
      supplierId: supplierId ?? null,
      isActive: isActive ?? undefined
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } }
    }
  })
  res.json({ product })
}))

router.patch('/:id/stock', validate(stockAdjustSchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { quantity, type } = req.body
  const userId = req.user?.userId || null

  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }

  const delta = type === 'in' ? parseFloat(quantity) : -parseFloat(quantity)
  const newStock = product.stock + delta
  if (newStock < 0) {
    res.status(400).json({ error: 'Stock insuficiente' })
    return
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id },
      data: { stock: newStock },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } }
      }
    })

    await tx.inventoryMovement.create({
      data: {
        productId: id,
        type: type === 'in' ? 'entry' : 'exit',
        quantity: parseFloat(quantity),
        userId
      }
    })

    return updated
  })

  res.json({ product: result })
}))

router.patch('/:id/deactivate', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }
  const updated = await prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } }
    }
  })
  res.json({ product: updated })
}))

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }

  const [invoiceItemCount, movementCount] = await Promise.all([
    prisma.invoiceItem.count({ where: { productId: id } }),
    prisma.inventoryMovement.count({ where: { productId: id } })
  ])

  const hasHistory = invoiceItemCount > 0 || movementCount > 0

  if (hasHistory && req.user?.role !== 'root') {
    res.status(403).json({
      error: 'Solo el propietario puede eliminar productos con facturas o movimientos asociados',
      invoiceCount: invoiceItemCount,
      movementCount
    })
    return
  }

  if (hasHistory) {
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.updateMany({ where: { productId: id }, data: { productId: null } })
      await tx.inventoryMovement.deleteMany({ where: { productId: id } })
      await tx.product.delete({ where: { id } })
    })
  } else {
    await prisma.product.delete({ where: { id } })
  }

  res.json({ ok: true })
}))

export default router
