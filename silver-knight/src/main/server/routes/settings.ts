import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware, adminMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/', async (_req: Request, res: Response) => {
  try {
    const all = await prisma.setting.findMany()
    const map: Record<string, string> = {}
    for (const s of all) map[s.key] = s.value
    res.json({ settings: map })
  } catch (error) {
    console.error('[settings] error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.put('/:key', adminMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string
    const { value } = req.body
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    })
    res.json({ setting })
  } catch (error) {
    console.error('[settings] upsert error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
