import { Router, Request, Response } from 'express'
import { prisma } from '../database/prisma'
import { authMiddleware, requirePermission } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'

const SYSTEM_KEYS = ['profile']

const router = Router()
router.use(authMiddleware)

router.get('/', requirePermission('settings'), asyncHandler(async (_req: Request, res: Response) => {
  const all = await prisma.setting.findMany()
  const map: Record<string, string> = {}
  for (const s of all) map[s.key] = s.value
  res.json({ settings: map })
}))

router.put('/:key', requirePermission('settings'), asyncHandler(async (req: Request, res: Response) => {
  const key = req.params.key as string
  const { value } = req.body

  if (SYSTEM_KEYS.includes(key) && req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Solo administradores pueden modificar esta configuración' })
    return
  }

  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value) }
  })
  res.json({ setting })
}))

export default router
