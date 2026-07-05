import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createProductSchema, updateProductSchema, stockAdjustSchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  const search = (req.query.search as string) || ''
  const categoryId = req.query.category as string | undefined
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = 20
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
      include: { category: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      skip,
      take: limit
    }),
    prisma.product.count({ where })
  ])

  res.json({ products, total, page, pages: Math.ceil(total / limit) })
})

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } }
  })
  if (!product) {
    res.status(404).json({ error: 'Producto no encontrado' })
    return
  }
  res.json({ product })
})

router.post('/', validate(createProductSchema), async (req: Request, res: Response) => {
  try {
    const {
      name,
      code,
      barcode,
      description,
      priceUsd,
      priceVes,
      costUsd,
      costVes,
      ivaRate,
      stock,
      minStock,
      categoryId
    } = req.body

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        code: code || null,
        barcode: barcode || null,
        description: description || null,
        priceUsd: parseFloat(priceUsd),
        priceVes: parseFloat(priceVes),
        costUsd: costUsd != null ? parseFloat(costUsd) : null,
        costVes: costVes != null ? parseFloat(costVes) : null,
        ivaRate: parseFloat(ivaRate) || 16,
        stock: parseFloat(stock) || 0,
        minStock: parseFloat(minStock) || 0,
        categoryId: categoryId || null
      },
      include: { category: { select: { id: true, name: true } } }
    })
    res.status(201).json({ product })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code: string; meta?: { target?: string[] } }
      if (e.code === 'P2002') {
        const field = e.meta?.target?.[0] || 'campo'
        res.status(409).json({ error: `Ya existe un producto con ese ${field}` })
        return
      }
    }
    logger.error('products', 'create error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', validate(updateProductSchema), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const {
      name,
      code,
      barcode,
      description,
      priceUsd,
      priceVes,
      costUsd,
      costVes,
      ivaRate,
      stock,
      minStock,
      categoryId,
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
        priceVes: parseFloat(priceVes),
        costUsd: costUsd != null ? parseFloat(costUsd) : null,
        costVes: costVes != null ? parseFloat(costVes) : null,
        ivaRate: parseFloat(ivaRate) || 16,
        stock: stock != null ? parseFloat(stock) : undefined,
        minStock: parseFloat(minStock) || 0,
        categoryId: categoryId ?? null,
        isActive: isActive ?? undefined
      },
      include: { category: { select: { id: true, name: true } } }
    })
    res.json({ product })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code: string }
      if (e.code === 'P2002') {
        res.status(409).json({ error: 'Ya existe un producto con ese código' })
        return
      }
      if (e.code === 'P2025') {
        res.status(404).json({ error: 'Producto no encontrado' })
        return
      }
    }
    logger.error('products', 'update error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.patch('/:id/stock', validate(stockAdjustSchema), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { quantity, type } = req.body

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

    const updated = await prisma.product.update({
      where: { id },
      data: { stock: newStock },
      include: { category: { select: { id: true, name: true } } }
    })
    res.json({ product: updated })
  } catch (error) {
    logger.error('products', 'stock error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
