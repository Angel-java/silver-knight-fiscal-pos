import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { createCategorySchema, updateCategorySchema } from '../validation/schemas'
import { logger } from '../utils/logger'

const router = Router()
router.use(authMiddleware)
router.use(requirePermission('categories'))

router.get('/', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } })
  res.json({ categories })
})

router.post('/', validate(createCategorySchema), async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body
    const category = await prisma.category.create({
      data: { name: name.trim(), description: description || null }
    })
    res.status(201).json({ category })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({ error: 'Ya existe una categoría con ese nombre' })
      return
    }
    logger.error('categories', 'create error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:id', validate(updateCategorySchema), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    const { name, description } = req.body
    const category = await prisma.category.update({
      where: { id },
      data: { name: name.trim(), description: description ?? null }
    })
    res.json({ category })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      res.status(409).json({ error: 'Ya existe una categoría con ese nombre' })
      return
    }
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Categoría no encontrada' })
      return
    }
    logger.error('categories', 'update error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string
    await prisma.category.delete({ where: { id } })
    res.json({ ok: true })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2025'
    ) {
      res.status(404).json({ error: 'Categoría no encontrada' })
      return
    }
    logger.error('categories', 'delete error', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})
export default router
