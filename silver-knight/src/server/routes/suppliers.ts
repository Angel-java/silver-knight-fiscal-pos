import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createSupplierSchema, updateSupplierSchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('products'))

router.get('/', asyncHandler(async (req: Request, res: Response) => {
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
}))

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id as string },
    include: { products: { select: { id: true, name: true, code: true } } }
  })
  if (!supplier) {
    res.status(404).json({ error: 'Proveedor no encontrado' })
    return
  }
  res.json({ supplier })
}))

router.post('/', validate(createSupplierSchema), asyncHandler(async (req: Request, res: Response) => {
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
}))

router.put('/:id', validate(updateSupplierSchema), asyncHandler(async (req: Request, res: Response) => {
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
}))

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  await prisma.supplier.delete({ where: { id } })
  res.json({ ok: true })
}))

export default router
