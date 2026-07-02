import { Router, Request, Response } from 'express'
import { prisma } from '../../database/prisma'
import { authMiddleware } from '../middleware/auth'

const router = Router()
router.use(authMiddleware)

router.get('/', async (req: Request, res: Response) => {
  try {
    const latest = req.query.latest === 'true'
    if (latest) {
      const rate = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } })
      res.json({ rate })
      return
    }
    const rates = await prisma.exchangeRate.findMany({ orderBy: { date: 'desc' }, take: 50 })
    res.json({ rates })
  } catch (error) {
    console.error('[exchange-rates] error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { rate, source } = req.body
    if (!rate || rate <= 0) {
      res.status(400).json({ error: 'Tasa inválida' })
      return
    }
    const exchangeRate = await prisma.exchangeRate.create({
      data: { rate: parseFloat(rate), source: source || 'manual', date: new Date() }
    })
    res.status(201).json({ rate: exchangeRate })
  } catch (error) {
    console.error('[exchange-rates] create error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
})

export default router
