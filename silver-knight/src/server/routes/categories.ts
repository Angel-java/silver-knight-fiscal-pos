import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCategorySchema, updateCategorySchema } from '../validation/schemas'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('categories'))

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  res.json({ categories })
}))

router.post('/', validate(createCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body
  const category = await prisma.category.create({
    data: { name: name.trim(), description: description || null }
  })
  res.status(201).json({ category })
}))

router.put('/:id', validate(updateCategorySchema), asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  const { name, description } = req.body
  const category = await prisma.category.update({
    where: { id },
    data: { name: name.trim(), description: description ?? null }
  })
  res.json({ category })
}))

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string
  await prisma.category.delete({ where: { id } })
  res.json({ ok: true })
}))

export default router
