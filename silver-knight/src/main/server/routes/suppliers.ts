import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createSupplierSchema, updateSupplierSchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('products'))

router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string) || ''
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { rif: { contains: search } }
          ]
        }
      : {}
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } }
    })
    res.json({ suppliers })
  } catch (error) {
    logger.error('suppliers', 'list error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: req.params.id as string },
      include: { products: { select: { id: true, name: true, code: true } } }
    })
    if (!supplier) {
      res.status(404).json({ error: 'Proveedor no encontrado' })
      return
    }
    res.json({ supplier })
  } catch (error) {
    logger.error('suppliers', 'get error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', validate(createSupplierSchema), async (req: Request, res: Response) => {
  try {
    const { name, rif, phone, email, address } = req.body
    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        rif: rif || null,
        phone: phone || null,
        email: email || null,
        address: address || null
      }
    })
    res.status(201).json({ supplier })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({ error: 'Ya existe un proveedor con ese nombre' })
      return
    }
    logger.error('suppliers', 'create error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', validate(updateSupplierSchema), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, rif, phone, email, address } = req.body
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: name.trim(),
        rif: rif ?? null,
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null
      }
    })
    res.json({ supplier })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({ error: 'Ya existe un proveedor con ese nombre' })
      return
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Proveedor no encontrado' })
      return
    }
    logger.error('suppliers', 'update error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.supplier.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Proveedor no encontrado' })
      return
    }
    logger.error('suppliers', 'delete error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
